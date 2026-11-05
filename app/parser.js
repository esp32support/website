"use strict";

// Line parser for the ESP32 CAN sniffer serial protocol.
// Firmware line: id,rtr,ide,dlc,d0 d1 d2 ...,BUS   e.g.  3c3,0,0,8,00 1f 00 10 00 00 00 00,B-CAN
// Same acceptance rules as the desktop app (message_processor.py), slightly stricter on truncated lines.
(function (root) {
    var MAX_LINE = 1000;
    var MAX_ID = 0x1fffffff;
    var HEX = /^[0-9a-fA-F]*$/;

    function hexByte(n) {
        return (n < 16 ? "0" : "") + n.toString(16);
    }

    // 11-bit IDs print as 3 hex digits, 29-bit as 8, like the dictionary and the desktop table.
    function formatId(value, ext) {
        var s = value.toString(16).toUpperCase();
        var width = ext ? 8 : 3;
        while (s.length < width) s = "0" + s;
        return s;
    }

    // Returns {type:"frame", ...}, {type:"temp", text}, or {type:"text", text} (banners, replies, noise).
    function parseLine(raw) {
        var line = String(raw).trim();
        if (!line) return null;
        if (line.length > MAX_LINE) return { type: "text", text: "(oversized line dropped)" };
        if (line.indexOf("[ESP32 Temp]") === 0) return { type: "temp", text: line };

        var parts = line.split(",").map(function (p) { return p.trim(); });
        while (parts.length && parts[0] === "") parts.shift(); // UART noise / leading comma
        if (parts.length < 4 || parts.length > 6) return { type: "text", text: line };

        var idStr = parts[0], rtr = parts[1], ide = parts[2], dlcStr = null, dataStr, bus = "";
        if (parts.length === 6) { dlcStr = parts[3]; dataStr = parts[4]; bus = parts[5]; }
        else if (parts.length === 5) { dlcStr = parts[3]; dataStr = parts[4]; }
        else { dataStr = parts[3]; }

        if (!idStr || !HEX.test(idStr.replace(/^0x/i, ""))) return { type: "text", text: line };
        var idVal = parseInt(idStr.replace(/^0x/i, ""), 16);
        if (isNaN(idVal) || idVal < 0 || idVal > MAX_ID) return { type: "text", text: line };
        if ((rtr !== "0" && rtr !== "1") || (ide !== "0" && ide !== "1")) return { type: "text", text: line };

        var clean = dataStr.replace(/[ \t]/g, "");
        if (!HEX.test(clean) || clean.length % 2 !== 0 || clean.length > 16) return { type: "text", text: line };

        var data = [];
        for (var i = 0; i < clean.length; i += 2) data.push(parseInt(clean.substr(i, 2), 16));

        if (dlcStr !== null) {
            if (!/^\d+$/.test(dlcStr)) return { type: "text", text: line };
            var dlc = parseInt(dlcStr, 10);
            if (dlc > 8) return { type: "text", text: line };
            // A truncated line (cut by UART noise) has fewer bytes than its DLC says.
            if (rtr === "0" && data.length !== dlc) return { type: "text", text: line };
        }

        var ext = ide === "1";
        return {
            type: "frame",
            idValue: idVal,
            id: formatId(idVal, ext),
            rtr: rtr === "1",
            ext: ext,
            dlc: data.length,
            data: data,
            bus: bus
        };
    }

    // Collects arbitrary text chunks and returns the complete lines (handles \r\n and split lines).
    function LineSplitter() {
        this.buf = "";
    }
    LineSplitter.prototype.feed = function (chunk) {
        this.buf += chunk;
        var lines = [];
        var idx;
        while ((idx = this.buf.indexOf("\n")) >= 0) {
            lines.push(this.buf.slice(0, idx));
            this.buf = this.buf.slice(idx + 1);
        }
        if (this.buf.length > 4096) this.buf = ""; // a stream without newlines is not our protocol
        return lines;
    };


    // Reply to STATUS from the sniffer firmware:
    //   Messages received: N / Unique CAN IDs: N / Vehicle CAN: 50000 bps, LISTEN-ONLY / TX frames: N, failed: N
    //   RX driver buffer peak: P/256, hardware RX overflows: N / CAN error counters: REC=r TEC=t
    function parseStatus(lines) {
        var s = { messages: null, ids: null, bps: null, mode: "", running: true, tx: null, txFailed: null,
                  peak: null, capacity: null, overflows: null, rec: null, tec: null };
        for (var i = 0; i < lines.length; i++) {
            var l = String(lines[i]).trim(), m;
            if ((m = /^Messages received:\s*(\d+)/.exec(l))) s.messages = +m[1];
            else if ((m = /^Unique CAN IDs:\s*(\d+)/.exec(l))) s.ids = +m[1];
            else if ((m = /^Vehicle CAN:\s*(\d+)\s*bps,?\s*(.*)$/.exec(l))) { s.bps = +m[1]; s.mode = m[2]; s.running = !/NOT RUNNING/i.test(m[2]); }
            else if ((m = /^TX frames:\s*(\d+),\s*failed:\s*(\d+)/.exec(l))) { s.tx = +m[1]; s.txFailed = +m[2]; }
            else if ((m = /RX driver buffer peak:\s*(\d+)\s*\/\s*(\d+).*hardware RX overflows:\s*(\d+)/.exec(l))) { s.peak = +m[1]; s.capacity = +m[2]; s.overflows = +m[3]; }
            else if ((m = /REC=(\d+)\s+TEC=(\d+)/.exec(l))) { s.rec = +m[1]; s.tec = +m[2]; }
        }
        return s.bps === null && s.messages === null ? null : s;
    }

    // Plain-language reading of the counters. level: ok | warn | bad | info
    function statusVerdict(s) {
        if (!s.running) return { level: "bad", text: "The CAN controller is not running. Check the wiring, the module power and the crystal setting of the firmware." };
        if (s.peak === null) return { level: "info", text: "This firmware does not report loss counters. Flash the newer sniffer firmware to see them." };
        if (s.overflows > 0 || s.peak >= s.capacity) {
            return { level: "bad", text: "Frames were lost on the board: its receive buffer overflowed (" + s.overflows + " overflow" + (s.overflows === 1 ? "" : "s") + ", buffer peak " + s.peak + "/" + s.capacity + ")." };
        }
        if (s.peak >= Math.floor(s.capacity * 0.75)) {
            return { level: "warn", text: "The receive buffer got close to full (peak " + s.peak + "/" + s.capacity + "). Frames may be lost when the bus is busier." };
        }
        if (Math.max(s.rec || 0, s.tec || 0) >= 96) {
            return { level: "warn", text: "The CAN controller sees bus errors (REC " + s.rec + ", TEC " + s.tec + "). Check the CAN speed and the wiring." };
        }
        return { level: "ok", text: "No loss on the board side (buffer peak " + s.peak + "/" + s.capacity + ", no overflows)." };
    }

    var api = { parseLine: parseLine, LineSplitter: LineSplitter, hexByte: hexByte, formatId: formatId, parseStatus: parseStatus, statusVerdict: statusVerdict };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.CanParser = api;
})(typeof window !== "undefined" ? window : globalThis);

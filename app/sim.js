"use strict";

// Simulated bus for developing and trying the page without hardware. It emits the same text the
// firmware prints (including the boot banner, temperature lines and the occasional corrupted line),
// cut at random places, so the parser and line splitter are exercised exactly like on a real port.
// The frames are made up; nothing here comes from a car.
(function (root) {
    function Simulator(onText, opts) {
        opts = opts || {};
        this.onText = onText;
        this.rate = opts.rate || 600;          // total frames per second
        this.corruptEvery = opts.corruptEvery === undefined ? 400 : opts.corruptEvery;
        this.timer = null;
        this.tick = 0;
        this.sent = 0;
        this.defs = this._buildDefs();
        this.weights = 0;
        for (var i = 0; i < this.defs.length; i++) this.weights += this.defs[i].hz;
    }

    Simulator.prototype._buildDefs = function () {
        var defs = [
            { id: 0x380, hz: 20, data: [0x02, 0, 0, 0, 0, 0, 0, 0], mutate: function (d) { d[1] = (d[1] + 1) & 0x0f; } },
            { id: 0x3c3, hz: 10, data: [0x1f, 0x80, 0, 0x10, 0, 0, 0, 0], mutate: function (d, n) { if (n % 25 === 0) d[1] = 0x40 + (n % 5) * 8; } },
            { id: 0x3c4, hz: 10, data: [0, 0, 0, 0, 0, 0, 0, 0], mutate: function (d, n) { d[0] = n % 60 < 4 ? 0x04 : 0; } },
            { id: 0x6c3, hz: 2, data: [0x12, 0x34, 0x56, 0, 0, 0, 0, 0], mutate: function (d) { d[2] = (d[2] + 1) & 255; } }
        ];
        var seed = 7;
        function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
        for (var i = 0; i < 36; i++) {
            var id = 0x0a0 + i * 0x13;
            var base = [];
            for (var k = 0; k < 8; k++) base.push(Math.floor(rnd() * 256));
            defs.push({
                id: id,
                hz: [1, 2, 5, 10, 20, 50][i % 6],
                data: base,
                dlc: 4 + (i % 5),
                mutate: (function (rate) {
                    return function (d, n) { if (n % rate === 0) d[n % 3] = (d[n % 3] + 1) & 255; };
                })(3 + (i % 7))
            });
        }
        return defs;
    };

    Simulator.prototype._pick = function () {
        var r = Math.random() * this.weights;
        for (var i = 0; i < this.defs.length; i++) {
            r -= this.defs[i].hz;
            if (r <= 0) return this.defs[i];
        }
        return this.defs[0];
    };

    Simulator.prototype._frameLine = function (def) {
        var d = def.data;
        def.count = (def.count || 0) + 1;
        def.mutate(d, def.count);
        var dlc = def.dlc || 8;
        var bytes = [];
        for (var i = 0; i < dlc; i++) bytes.push((d[i] < 16 ? "0" : "") + d[i].toString(16));
        return def.id.toString(16) + ",0,0," + dlc + "," + bytes.join(" ") + ",B-CAN";
    };

    // Delivers text in pieces cut at random positions.
    Simulator.prototype._emit = function (text) {
        var pos = 0;
        while (pos < text.length) {
            var n = 8 + Math.floor(Math.random() * 60);
            this.onText(text.slice(pos, pos + n));
            pos += n;
        }
    };

    Simulator.prototype.start = function () {
        if (this.timer) return;
        var self = this;
        this._emit(
            "\nESP32 CAN Sniffer (USB only) @ 921600\nInitializing MCP2518FD (classic CAN 2.0B, LISTEN-ONLY)...\n" +
            "CAN Sniffer Ready. Waiting for CAN messages...\nFormat: id,rtr,ide,dlc,data,B-CAN\n---\n"
        );
        this.timer = setInterval(function () {
            var perTick = Math.max(1, Math.round(self.rate / 20));
            var out = "";
            for (var i = 0; i < perTick; i++) {
                self.sent++;
                if (self.corruptEvery && self.sent % self.corruptEvery === 0) out += "3c3,0,0,8,00 1f 0\n";
                else out += self._frameLine(self._pick()) + "\n";
            }
            self.tick++;
            if (self.tick % 200 === 0) out += "[ESP32 Temp] 41.5 °C\n";
            self._emit(out);
        }, 50);
    };

    Simulator.prototype.stop = function () {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    };

    Simulator.prototype.setRate = function (rate) {
        this.rate = rate;
    };

    var api = { Simulator: Simulator };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.CanSim = api;
})(typeof window !== "undefined" ? window : globalThis);

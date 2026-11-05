"use strict";

// Web Serial link to the ESP32 sniffer (Chrome, USB, 921600 baud 8N1, text lines).
// This page only watches the bus. The command whitelist below is enforced in code: nothing that enables
// transmitting (TX ON, SEND, SENDP, TEST ...) can be sent from here, whatever the UI asks for.
(function (root) {
    var ALLOWED = /^(CONNECT|SPEED|STATUS|DETECTCAN|SETCAN (50|100|125|250|500))$/;
    var READ_BUFFER = 262144;

    function fail(code, cause) {
        var e = new Error(code + (cause && cause.message ? ": " + cause.message : ""));
        e.code = code; // "unsupported" | "cancelled" | "busy" | "lost" | "forbidden"
        e.cause = cause;
        return e;
    }

    function SerialLink(opts) {
        this.api = opts.api;
        this.onText = opts.onText;
        this.onClose = opts.onClose || function () {};
        this.baud = opts.baud || 921600;
        this.port = null;
        this.writer = null;
        this.reader = null;
        this.closing = false;
        this.closed = false;
        this.loop = null;
        this._onDisconnect = null;
    }

    SerialLink.prototype.open = async function () {
        if (!this.api) throw fail("unsupported");
        var port;
        try {
            port = await this.api.requestPort();
        } catch (e) {
            if (e && (e.name === "NotFoundError" || e.name === "AbortError")) throw fail("cancelled", e);
            throw fail("busy", e);
        }
        try {
            await port.open({ baudRate: this.baud, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none", bufferSize: READ_BUFFER });
        } catch (e) {
            throw fail("busy", e); // most often: another program (the desktop app) already holds the port
        }
        this.port = port;
        // Opening can pulse DTR/RTS, which resets many ESP32 boards. Release both lines right away so the board runs.
        try { await port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch (e) { /* not supported everywhere */ }
        this.writer = port.writable.getWriter();
        var self = this;
        if (this.api.addEventListener) {
            this._onDisconnect = function (ev) {
                if (ev && ev.target === port) self._finish("lost");
            };
            this.api.addEventListener("disconnect", this._onDisconnect);
        }
        this.loop = this._readLoop();
    };

    SerialLink.prototype._readLoop = async function () {
        var decoder = new TextDecoder("utf-8");
        var reason = null;
        try {
            // outer loop: a recoverable read error (framing, buffer overrun) leaves port.readable usable
            while (this.port && this.port.readable && !this.closing) {
                this.reader = this.port.readable.getReader();
                try {
                    for (;;) {
                        var r = await this.reader.read();
                        if (r.done) break;
                        if (r.value && r.value.length) this.onText(decoder.decode(r.value, { stream: true }));
                    }
                } catch (e) {
                    reason = e;
                } finally {
                    try { this.reader.releaseLock(); } catch (e) { /* already released */ }
                    this.reader = null;
                }
                if (reason && !(this.port && this.port.readable)) break; // fatal error (device removed)
                reason = null;
                if (!this.closing) break; // stream ended on its own
            }
        } finally {
            if (!this.closing) this._finish("lost");
        }
    };

    SerialLink.prototype.send = async function (command) {
        var cmd = String(command).trim().toUpperCase();
        if (!ALLOWED.test(cmd)) throw fail("forbidden");
        if (!this.writer || this.closed) throw fail("lost");
        await this.writer.write(new TextEncoder().encode(cmd + "\n"));
    };

    SerialLink.prototype._finish = function (reason) {
        if (this.closed) return;
        this.closed = true;
        if (this.api && this.api.removeEventListener && this._onDisconnect) this.api.removeEventListener("disconnect", this._onDisconnect);
        try { if (this.writer) this.writer.releaseLock(); } catch (e) { /* ignore */ }
        this.writer = null;
        var port = this.port;
        this.port = null;
        if (port) { try { port.close().catch(function () {}); } catch (e) { /* ignore */ } }
        this.onClose(reason);
    };

    SerialLink.prototype.close = async function () {
        if (this.closed) return;
        this.closing = true;
        try { if (this.reader) await this.reader.cancel(); } catch (e) { /* ignore */ }
        try { if (this.loop) await this.loop; } catch (e) { /* ignore */ }
        var port = this.port;
        try { if (this.writer) this.writer.releaseLock(); } catch (e) { /* ignore */ }
        this.writer = null;
        this.closed = true;
        this.port = null;
        if (this.api && this.api.removeEventListener && this._onDisconnect) this.api.removeEventListener("disconnect", this._onDisconnect);
        try { if (port) await port.close(); } catch (e) { /* ignore */ }
        this.onClose("closed");
    };

    var api = { SerialLink: SerialLink, ALLOWED: ALLOWED };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.CanSerial = api;
})(typeof window !== "undefined" ? window : globalThis);

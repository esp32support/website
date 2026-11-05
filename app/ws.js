"use strict";

// WebSocket link to the sniffer over its own Wi-Fi (the page is then served by the board itself, over http).
// Same interface as the USB link in serial.js: open(), send(), close(), onText, onClose.
// Same command whitelist: nothing that enables transmitting can be sent from here.
(function (root) {
    var ALLOWED = (root.CanSerial && root.CanSerial.ALLOWED) || /^(CONNECT|SPEED|STATUS|DETECTCAN|SETCAN (50|100|125|250|500))$/;
    var OPEN_TIMEOUT_MS = 5000;

    function fail(code, cause) {
        var e = new Error(code + (cause && cause.message ? ": " + cause.message : ""));
        e.code = code; // "busy" (could not reach the board) | "lost" | "forbidden"
        e.cause = cause;
        return e;
    }

    function WsLink(opts) {
        this.url = opts.url;
        this.onText = opts.onText;
        this.onClose = opts.onClose || function () {};
        this.WebSocketImpl = opts.WebSocketImpl || root.WebSocket;
        this.ws = null;
        this.closing = false;
        this.closed = false;
    }

    WsLink.prototype.open = function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            var ws, settled = false;
            try {
                ws = new self.WebSocketImpl(self.url);
            } catch (e) {
                reject(fail("busy", e));
                return;
            }
            self.ws = ws;
            var timer = setTimeout(function () {
                if (settled) return;
                settled = true;
                try { ws.close(); } catch (e) { /* ignore */ }
                reject(fail("busy"));
            }, OPEN_TIMEOUT_MS);
            ws.onopen = function () {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve();
            };
            ws.onerror = function () {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(fail("busy"));
            };
            ws.onmessage = function (ev) {
                if (typeof ev.data === "string" && ev.data.length) self.onText(ev.data);
            };
            ws.onclose = function () {
                if (!settled) { settled = true; clearTimeout(timer); reject(fail("busy")); return; }
                self._finish("lost");
            };
        });
    };

    WsLink.prototype.send = async function (command) {
        var cmd = String(command).trim().toUpperCase();
        if (!ALLOWED.test(cmd)) throw fail("forbidden");
        if (!this.ws || this.closed || this.ws.readyState !== 1) throw fail("lost");
        this.ws.send(cmd + "\n");
    };

    WsLink.prototype._finish = function (reason) {
        if (this.closed) return;
        this.closed = true;
        this.onClose(this.closing ? "closed" : reason);
    };

    WsLink.prototype.close = async function () {
        if (this.closed) return;
        this.closing = true;
        try { if (this.ws) this.ws.close(); } catch (e) { /* ignore */ }
        this._finish("closed");
    };

    var api = { WsLink: WsLink, ALLOWED: ALLOWED };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.CanWs = api;
})(typeof window !== "undefined" ? window : globalThis);

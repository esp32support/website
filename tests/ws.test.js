"use strict";
// Run:  node tests/ws.test.js     (from the website folder)
var assert = require("assert");
var W = require("../app/ws.js");

var passed = 0;
var tick = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 5); }); };
async function test(name, fn) { await fn(); passed++; console.log("ok  " + name); }

// Minimal fake WebSocket: behaviour chosen by the URL.
function makeFakeSocket(log) {
    return function FakeSocket(url) {
        var s = this;
        s.url = url;
        s.readyState = 0;
        s.sent = [];
        log.push(s);
        s.send = function (t) { s.sent.push(t); };
        s.close = function () { s.readyState = 3; if (s.onclose) s.onclose(); };
        setTimeout(function () {
            if (url.indexOf("unreachable") >= 0) { if (s.onerror) s.onerror(); if (s.onclose) s.onclose(); return; }
            s.readyState = 1;
            if (s.onopen) s.onopen();
        }, 2);
    };
}

(async function () {
    await test("opens, receives text, sends allowed commands", async function () {
        var socks = [], got = "", closed = [];
        var l = new W.WsLink({ url: "ws://192.168.4.1:81/", WebSocketImpl: makeFakeSocket(socks), onText: function (t) { got += t; }, onClose: function (r) { closed.push(r); } });
        await l.open();
        socks[0].onmessage({ data: "3c3,0,0,2,aa bb,B-CAN\n" });
        socks[0].onmessage({ data: "CONNECTED\n" });
        assert.strictEqual(got, "3c3,0,0,2,aa bb,B-CAN\nCONNECTED\n");
        await l.send("connect"); await l.send("SETCAN 500"); await l.send("STATUS");
        assert.deepStrictEqual(socks[0].sent, ["CONNECT\n", "SETCAN 500\n", "STATUS\n"]);
        await l.close();
        assert.deepStrictEqual(closed, ["closed"]);
    });

    await test("transmit commands are refused in code", async function () {
        var socks = [];
        var l = new W.WsLink({ url: "ws://x/", WebSocketImpl: makeFakeSocket(socks), onText: function () {} });
        await l.open();
        var bad = ["TX ON", "SEND 123 1 FF", "SENDP 123 10 1 FF", "TEST", "SETCAN 7", "SETCAN 500\nTX ON", "FWRESET", ""];
        for (var i = 0; i < bad.length; i++) {
            var code = null;
            try { await l.send(bad[i]); } catch (e) { code = e.code; }
            assert.strictEqual(code, "forbidden", JSON.stringify(bad[i]));
        }
        assert.strictEqual(socks[0].sent.length, 0);
        await l.close();
    });

    await test("unreachable board is reported as busy", async function () {
        var l = new W.WsLink({ url: "ws://unreachable/", WebSocketImpl: makeFakeSocket([]), onText: function () {} });
        var code = null;
        try { await l.open(); } catch (e) { code = e.code; }
        assert.strictEqual(code, "busy");
    });

    await test("connection dropping reports lost once, later sends fail", async function () {
        var socks = [], closed = [];
        var l = new W.WsLink({ url: "ws://x/", WebSocketImpl: makeFakeSocket(socks), onText: function () {}, onClose: function (r) { closed.push(r); } });
        await l.open();
        socks[0].readyState = 3; socks[0].onclose(); socks[0].onclose();
        await tick();
        assert.deepStrictEqual(closed, ["lost"]);
        var code = null;
        try { await l.send("SPEED"); } catch (e) { code = e.code; }
        assert.strictEqual(code, "lost");
    });

    console.log("\n" + passed + " tests passed");
})().catch(function (e) { console.error("FAILED:", e); process.exit(1); });

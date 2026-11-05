"use strict";
// Run:  node tests/serial.test.js     (from the website folder)
// Tests the Web Serial link against a fake port: no hardware needed.
var assert = require("assert");
var P = require("../app/parser.js");
var S = require("../app/serial.js");

var passed = 0;
var tick = function () { return new Promise(function (r) { setTimeout(r, 5); }); };

async function test(name, fn) {
    await fn();
    passed++;
    console.log("ok  " + name);
}

function makeFake(opts) {
    opts = opts || {};
    var ctrl;
    var enc = new TextEncoder(), dec = new TextDecoder();
    var state = { opened: null, signals: [], written: [], closed: false, requested: 0 };
    var readable = new ReadableStream({ start: function (c) { ctrl = c; } });
    var writable = new WritableStream({ write: function (chunk) { state.written.push(dec.decode(chunk)); } });
    var port = {
        open: async function (o) {
            if (opts.busy) throw new DOMException("Failed to open serial port.", "NetworkError");
            state.opened = o;
        },
        setSignals: async function (s) { state.signals.push(s); },
        readable: readable,
        writable: writable,
        close: async function () { state.closed = true; }
    };
    var listeners = [];
    var api = {
        requestPort: async function () {
            state.requested++;
            if (opts.cancel) throw new DOMException("No port selected by the user.", "NotFoundError");
            return port;
        },
        addEventListener: function (type, fn) { if (type === "disconnect") listeners.push(fn); },
        removeEventListener: function (type, fn) { listeners = listeners.filter(function (f) { return f !== fn; }); }
    };
    return {
        api: api, port: port, state: state,
        push: function (text) { ctrl.enqueue(typeof text === "string" ? enc.encode(text) : text); },
        failRead: function (err) { ctrl.error(err); },
        unplug: function () { listeners.slice().forEach(function (fn) { fn({ target: port }); }); },
        listenerCount: function () { return listeners.length; }
    };
}

function makeLink(fake) {
    var got = { text: "", closed: [] };
    var link = new S.SerialLink({
        api: fake.api,
        onText: function (t) { got.text += t; },
        onClose: function (r) { got.closed.push(r); }
    });
    return { link: link, got: got };
}

(async function () {
    await test("opens at 921600 8N1 and releases DTR/RTS", async function () {
        var f = makeFake(); var l = makeLink(f);
        await l.link.open();
        assert.strictEqual(f.state.opened.baudRate, 921600);
        assert.strictEqual(f.state.opened.dataBits, 8);
        assert.strictEqual(f.state.opened.parity, "none");
        assert.deepStrictEqual(f.state.signals[0], { dataTerminalReady: false, requestToSend: false });
        await l.link.close();
    });

    await test("received text arrives in order, split UTF-8 survives", async function () {
        var f = makeFake(); var l = makeLink(f);
        await l.link.open();
        f.push("3c3,0,0,2,aa bb,B-CAN\n[ESP32 Temp] 41.5 ");
        var deg = new TextEncoder().encode("°C\n"); // degree sign is two bytes
        f.push(deg.slice(0, 1));
        f.push(deg.slice(1));
        await tick(); await tick();
        assert.strictEqual(l.got.text, "3c3,0,0,2,aa bb,B-CAN\n[ESP32 Temp] 41.5 °C\n");
        await l.link.close();
    });

    await test("only the safe command set can be sent", async function () {
        var f = makeFake(); var l = makeLink(f);
        await l.link.open();
        await l.link.send("CONNECT");
        await l.link.send("setcan 500");
        await l.link.send("SPEED");
        await l.link.send("DETECTCAN");
        assert.deepStrictEqual(f.state.written, ["CONNECT\n", "SETCAN 500\n", "SPEED\n", "DETECTCAN\n"]);
        var bad = ["TX ON", "tx on", "SEND 123 1 FF", "SENDP 123 10 1 FF", "TEST", "SETCAN 7", "SETCAN 500\nTX ON", "CONNECT\nTX ON", "SETCAN 50; TX ON", "FWRESET", ""];
        for (var i = 0; i < bad.length; i++) {
            var code = null;
            try { await l.link.send(bad[i]); } catch (e) { code = e.code; }
            assert.strictEqual(code, "forbidden", "should refuse: " + JSON.stringify(bad[i]));
        }
        assert.strictEqual(f.state.written.length, 4, "nothing extra was written");
        await l.link.close();
    });

    await test("user cancels the port chooser", async function () {
        var f = makeFake({ cancel: true }); var l = makeLink(f);
        var code = null;
        try { await l.link.open(); } catch (e) { code = e.code; }
        assert.strictEqual(code, "cancelled");
    });

    await test("port held by another program is reported as busy", async function () {
        var f = makeFake({ busy: true }); var l = makeLink(f);
        var code = null;
        try { await l.link.open(); } catch (e) { code = e.code; }
        assert.strictEqual(code, "busy");
    });

    await test("no Web Serial in this browser", async function () {
        var l = new S.SerialLink({ api: undefined, onText: function () {} });
        var code = null;
        try { await l.open(); } catch (e) { code = e.code; }
        assert.strictEqual(code, "unsupported");
    });

    await test("close() releases the port and later sends fail", async function () {
        var f = makeFake(); var l = makeLink(f);
        await l.link.open();
        await l.link.close();
        assert.strictEqual(f.state.closed, true);
        assert.deepStrictEqual(l.got.closed, ["closed"]);
        assert.strictEqual(f.listenerCount(), 0);
        var code = null;
        try { await l.link.send("SPEED"); } catch (e) { code = e.code; }
        assert.strictEqual(code, "lost");
    });

    await test("unplugging reports lost exactly once", async function () {
        var f = makeFake(); var l = makeLink(f);
        await l.link.open();
        f.unplug(); f.unplug();
        await tick();
        assert.deepStrictEqual(l.got.closed, ["lost"]);
        assert.strictEqual(f.state.closed, true);
    });

    await test("fatal read error reports lost", async function () {
        var f = makeFake(); var l = makeLink(f);
        await l.link.open();
        f.failRead(new Error("device removed"));
        await tick(); await tick();
        assert.deepStrictEqual(l.got.closed, ["lost"]);
    });

    await test("3000 frames/s for 3 s through the link parse without loss", async function () {
        var f = makeFake(); var l = makeLink(f);
        var splitter = new P.LineSplitter(), frames = 0, text = 0;
        var link = new S.SerialLink({
            api: f.api,
            onText: function (t) {
                splitter.feed(t).forEach(function (line) {
                    var r = P.parseLine(line);
                    if (r && r.type === "frame") frames++; else if (r) text++;
                });
            },
            onClose: function () {}
        });
        await link.open();
        var out = "";
        for (var i = 0; i < 9000; i++) {
            out += (0x100 + (i % 40)).toString(16) + ",0,0,8,12 34 56 78 9a bc de f0,B-CAN\n";
            if (out.length > 3000) { f.push(out); out = ""; await tick(); }
        }
        if (out) f.push(out);
        await tick(); await tick();
        assert.strictEqual(frames, 9000);
        assert.strictEqual(text, 0);
        await link.close();
    });

    console.log("\n" + passed + " tests passed");
})().catch(function (e) {
    console.error("FAILED:", e);
    process.exit(1);
});

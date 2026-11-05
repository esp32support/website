"use strict";
// Run:  node tests/parser.test.js     (from the website folder)
var assert = require("assert");
var P = require("../app/parser.js");
var S = require("../app/sim.js");

var passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log("ok  " + name);
}

test("valid six-field firmware line", function () {
    var f = P.parseLine("3c3,0,0,8,00 1f 00 10 00 00 00 00,B-CAN");
    assert.strictEqual(f.type, "frame");
    assert.strictEqual(f.id, "3C3");
    assert.strictEqual(f.dlc, 8);
    assert.deepStrictEqual(f.data, [0, 0x1f, 0, 0x10, 0, 0, 0, 0]);
    assert.strictEqual(f.bus, "B-CAN");
    assert.strictEqual(f.ext, false);
});

test("short ID is padded, extended ID is 8 digits", function () {
    assert.strictEqual(P.parseLine("10,0,0,1,ff,B-CAN").id, "010");
    var e = P.parseLine("18daf110,0,1,2,aa bb,C-CAN");
    assert.strictEqual(e.id, "18DAF110");
    assert.strictEqual(e.ext, true);
});

test("remote frame and zero length", function () {
    var r = P.parseLine("123,1,0,0,,B-CAN");
    assert.strictEqual(r.type, "frame");
    assert.strictEqual(r.rtr, true);
    assert.strictEqual(r.dlc, 0);
});

test("leading comma / UART noise is tolerated", function () {
    assert.strictEqual(P.parseLine(",,3c3,0,0,2,aa bb,B-CAN").id, "3C3");
});

test("five-field line without bus tag", function () {
    assert.strictEqual(P.parseLine("3c3,0,0,2,aa bb").bus, "");
});

test("banners, replies and statistics are text, not frames", function () {
    [
        "ESP32 CAN Sniffer (USB only) @ 921600",
        "CONNECTED",
        "OK vehicle CAN set to 50000 bps (MCP2518FD 20 MHz crystal build)",
        "Format: id,rtr,ide,dlc,data,B-CAN",
        "--- STATISTICS ---",
        "  0x3c3: 12 messages",
        "---"
    ].forEach(function (l) { assert.strictEqual(P.parseLine(l).type, "text", l); });
});

test("temperature line", function () {
    assert.strictEqual(P.parseLine("[ESP32 Temp] 41.5 °C").type, "temp");
});

test("rejects bad rtr/ide, non-hex data, too many bytes, id out of range", function () {
    assert.strictEqual(P.parseLine("3c3,0,8,8,00 00 00 00 00 00 00 00,B-CAN").type, "text");
    assert.strictEqual(P.parseLine("3c3,2,0,1,00,B-CAN").type, "text");
    assert.strictEqual(P.parseLine("3c3,0,0,2,zz 00,B-CAN").type, "text");
    assert.strictEqual(P.parseLine("3c3,0,0,9,00 00 00 00 00 00 00 00 00,B-CAN").type, "text");
    assert.strictEqual(P.parseLine("20000000,0,1,1,00,B-CAN").type, "text");
});

test("truncated line (fewer bytes than DLC) is rejected", function () {
    assert.strictEqual(P.parseLine("3c3,0,0,8,00 1f 0").type, "text");
    assert.strictEqual(P.parseLine("3c3,0,0,8,00 1f,B-CAN").type, "text");
});

test("oversized line and empty line", function () {
    assert.strictEqual(P.parseLine(new Array(1200).join("a")).type, "text");
    assert.strictEqual(P.parseLine("   "), null);
});

test("line splitter joins pieces and handles CRLF", function () {
    var s = new P.LineSplitter();
    assert.deepStrictEqual(s.feed("3c3,0,0,2,aa"), []);
    assert.deepStrictEqual(s.feed(" bb,B-CAN\r\n10,0,0,1,ff,B-"), ["3c3,0,0,2,aa bb,B-CAN\r"]);
    assert.deepStrictEqual(s.feed("CAN\n"), ["10,0,0,1,ff,B-CAN"]);
});

test("simulator output parses end to end through random cuts", function () {
    var splitter = new P.LineSplitter();
    var frames = 0, text = 0, temp = 0, ids = {};
    var sim = new S.Simulator(function (chunk) {
        splitter.feed(chunk).forEach(function (l) {
            var r = P.parseLine(l);
            if (!r) return;
            if (r.type === "frame") { frames++; ids[r.id] = true; }
            else if (r.type === "temp") temp++;
            else text++;
        });
    }, { rate: 2000, corruptEvery: 50 });
    // drive the generator directly instead of waiting for timers
    sim._emit("banner line\n");
    var out = "";
    for (var i = 0; i < 4000; i++) out += (i % 50 === 49 ? "3c3,0,0,8,00 1f 0" : sim._frameLine(sim._pick())) + "\n";
    sim._emit(out);
    assert.ok(frames >= 3900 && frames <= 4000, "frames " + frames);
    assert.ok(text >= 80, "rejected/text lines " + text);
    assert.ok(Object.keys(ids).length >= 30, "distinct ids " + Object.keys(ids).length);
});

console.log("\n" + passed + " tests passed");

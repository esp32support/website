"use strict";
// Optional local test: feeds REAL captured serial lines (from the desktop app's session recordings) through the
// parser and checks nothing valid is dropped. The recordings are not part of this repo.
// Run:  node tests/realdata.test.js [folder-with-jsonl-files]
var fs = require("fs");
var path = require("path");
var readline = require("readline");
var P = require("../app/parser.js");

var dir = process.argv[2] || path.join(process.env.LOCALAPPDATA || "", "ESP32_CAN_Sniffer", "session");
var files = ["canb_drive_19102026.jsonl", "canb_20102026.jsonl", "canc_20102026.jsonl"];
var MAX_LINES = 300000;

async function run(file) {
    var full = path.join(dir, file);
    if (!fs.existsSync(full)) { console.log("skip  " + file + " (not found)"); return true; }
    var rl = readline.createInterface({ input: fs.createReadStream(full), crlfDelay: Infinity });
    var splitter = new P.LineSplitter();
    var n = 0, frames = 0, text = 0, mismatches = 0, ext = 0;
    var ids = Object.create(null), buses = Object.create(null), bad = [];
    var t0 = process.hrtime.bigint();
    for await (var line of rl) {
        if (n >= MAX_LINES) break;
        var rec;
        try { rec = JSON.parse(line); } catch (e) { continue; }
        if (!rec || !rec.raw) continue;
        n++;
        // deliver in odd-sized pieces like a serial port does
        var chunk = rec.raw + "\n";
        var half = chunk.length >> 1;
        var out = splitter.feed(chunk.slice(0, half)).concat(splitter.feed(chunk.slice(half)));
        for (var i = 0; i < out.length; i++) {
            var r = P.parseLine(out[i]);
            if (!r) continue;
            if (r.type === "frame") {
                frames++;
                ids[r.id] = true;
                if (r.bus) buses[r.bus] = true;
                if (r.ext) ext++;
                // the recording stores the ID as text; it must equal ours after normalising case and leading zeros
                if (rec.id && parseInt(rec.id, 16) !== r.idValue) mismatches++;
            } else {
                text++;
                if (bad.length < 3) bad.push(out[i]);
            }
        }
    }
    var ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(file + ": lines " + n + ", frames " + frames + ", not frames " + text + ", ID mismatches " + mismatches +
        ", distinct IDs " + Object.keys(ids).length + ", ext " + ext + ", buses " + Object.keys(buses).join("/") +
        ", " + Math.round(n / (ms / 1000)) + " lines/s");
    if (bad.length) console.log("   examples of non-frame lines:", JSON.stringify(bad));
    // A UART can mangle the odd line (bytes of two frames interleaved). Those must be rejected, and must be rare.
    return mismatches === 0 && frames > 0 && text / n < 0.0005;
}

(async function () {
    var ok = true;
    for (var i = 0; i < files.length; i++) ok = (await run(files[i])) && ok;
    console.log(ok ? "\nreal data: all lines parsed" : "\nreal data: PROBLEMS above");
    process.exit(ok ? 0 : 1);
})();

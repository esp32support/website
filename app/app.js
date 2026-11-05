"use strict";

// Live view. Data sources (simulator now, USB later) push text into ingest(); everything downstream is shared.
(function () {
    var P = window.CanParser;
    var CHANGE_FLASH_MS = 1200;   // a changed byte stays highlighted this long
    var CHANGING_WINDOW_MS = 3000; // "Only changing" keeps IDs that changed within this window
    var RENDER_EVERY_MS = 125;     // table refresh rate (about 8 per second)

    var els = {
        unsupported: document.getElementById("unsupported"),
        note: document.getElementById("note"),
        connect: document.getElementById("connect"),
        sim: document.getElementById("sim"),
        speed: document.getElementById("speed"),
        detect: document.getElementById("detect"),
        status: document.getElementById("status"),
        fps: document.getElementById("fps"),
        ids: document.getElementById("ids"),
        filter: document.getElementById("filter"),
        onlyChanging: document.getElementById("onlyChanging"),
        pause: document.getElementById("pause"),
        rows: document.getElementById("rows"),
        empty: document.getElementById("empty"),
        nomatch: document.getElementById("nomatch"),
        cmpCapture: document.getElementById("cmpCapture"),
        cmpReset: document.getElementById("cmpReset"),
        cmpOnlyChanged: document.getElementById("cmpOnlyChanged"),
        cmpStatus: document.getElementById("cmpStatus"),
        cmpRows: document.getElementById("cmpRows"),
        detail: document.getElementById("detail"),
        dTitle: document.getElementById("dTitle"),
        dClose: document.getElementById("dClose"),
        dBits: document.getElementById("dBits"),
        dHist: document.getElementById("dHist")
    };
    var HISTORY_MAX = 12;

    // Anonymous usage counting. Only runs when the visitor accepted analytics cookies (gtag exists then).
    // Never includes CAN IDs or data: only which buttons were used and coarse numbers.
    var usage = { started: Date.now(), source: "none", selects: 0, filter: false, pause: false, changing: false, compare: false, sent: false };
    function track(name, params) {
        try {
            if (typeof window.gtag === "function" && window.gtagLoaded) window.gtag("event", name, params || {});
        } catch (err) { /* analytics must never break the page */ }
    }
    function bucket(n) {
        return n === 0 ? "0" : n < 10 ? "1-9" : n < 100 ? "10-99" : n < 1000 ? "100-999" : "1000+";
    }
    function sendSummary() {
        if (usage.sent || usage.source === "none") return;
        usage.sent = true;
        track("webui_session", {
            source: usage.source,
            seconds: Math.round((Date.now() - usage.started) / 1000),
            ids: bucket(state.order.length),
            frames: bucket(state.totalFrames),
            id_selects: usage.selects,
            used_filter: usage.filter,
            used_pause: usage.pause,
            used_only_changing: usage.changing,
            used_compare: usage.compare,
            transport_type: "beacon"
        });
    }
    window.addEventListener("pagehide", sendSummary);
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") sendSummary();
    });

    var state = {
        entries: Object.create(null), // id -> entry
        order: [],                    // ids sorted
        splitter: new P.LineSplitter(),
        source: null,                 // {name, stop()}
        totalFrames: 0,
        rejected: 0,
        framesThisSecond: 0,
        paused: false,
        onlyChanging: false,
        filterTerms: [],
        selected: null,
        baseline: null // key -> byte array, frozen when Capture baseline is pressed
    };

    // ---- ingest -------------------------------------------------------------------------------

    // Last few non-CAN lines (boot banner, command replies) with a timestamp: shows whether the board reset on connect.
    var textLog = [];
    function logText(text, now) {
        textLog.push({ t: Math.round(now), text: text.slice(0, 160) });
        if (textLog.length > 60) textLog.shift();
    }

    function ingestText(chunk) {
        var lines = state.splitter.feed(chunk);
        var now = performance.now();
        for (var i = 0; i < lines.length; i++) {
            var r = P.parseLine(lines[i]);
            if (!r) continue;
            if (r.type === "frame") onFrame(r, now);
            else if (r.type === "text") {
                logText(r.text, now);
                if (!onDeviceLine(r.text)) state.rejected++;
            }
        }
    }

    function onFrame(f, now) {
        var key = f.bus ? f.id + "|" + f.bus : f.id;
        var e = state.entries[key];
        if (!e) {
            e = state.entries[key] = {
                key: key, id: f.id, idValue: f.idValue, bus: f.bus, count: 0, lastCount: 0, hz: 0,
                data: [], changedAt: [0, 0, 0, 0, 0, 0, 0, 0], lastXor: [0, 0, 0, 0, 0, 0, 0, 0],
                lastChange: 0, history: [], histVersion: 0, dlc: 0, tr: null, cells: null, shown: null
            };
            state.order.push(key);
            state.order.sort(function (a, b) {
                var x = state.entries[a], y = state.entries[b];
                return x.idValue - y.idValue || (x.bus < y.bus ? -1 : 1);
            });
            e.needsInsert = true;
        }
        e.count++;
        state.totalFrames++;
        state.framesThisSecond++;
        var old = e.data;
        var differs = old.length !== f.data.length;
        for (var i = 0; i < f.data.length; i++) {
            if (old.length > 0 && old[i] !== f.data[i]) {
                e.changedAt[i] = now;
                e.lastXor[i] = old[i] ^ f.data[i];
                e.lastChange = now;
                differs = true;
            }
        }
        e.data = f.data;
        e.dlc = f.dlc;
        if (differs) {
            e.history.unshift({ wall: Date.now(), bytes: f.data });
            if (e.history.length > HISTORY_MAX) e.history.pop();
            e.histVersion++;
        }
    }

    // ---- rendering ----------------------------------------------------------------------------

    function hex2(n) {
        return (n < 16 ? "0" : "") + n.toString(16).toUpperCase();
    }

    function buildRow(e) {
        var tr = document.createElement("tr");
        tr.dataset.key = e.key;
        var tdId = document.createElement("td");
        tdId.className = "c-id mono";
        tdId.textContent = e.id;
        var tdHz = document.createElement("td");
        tdHz.className = "c-hz mono";
        var tdCnt = document.createElement("td");
        tdCnt.className = "c-cnt mono";
        var tdData = document.createElement("td");
        tdData.className = "bytes mono";
        var spans = [];
        for (var i = 0; i < 8; i++) {
            var s = document.createElement("span");
            s.className = "b";
            tdData.appendChild(s);
            spans.push(s);
        }
        tr.appendChild(tdId); tr.appendChild(tdHz); tr.appendChild(tdCnt); tr.appendChild(tdData);
        e.tr = tr;
        e.cells = { hz: tdHz, cnt: tdCnt, bytes: spans };
        e.shown = { sel: false, hz: "", cnt: "", bytes: ["", "", "", "", "", "", "", ""], flash: [false, false, false, false, false, false, false, false] };
        return tr;
    }

    function matchesFilter(e) {
        if (!state.filterTerms.length) return true;
        for (var i = 0; i < state.filterTerms.length; i++) {
            if (e.id.indexOf(state.filterTerms[i]) !== -1) return true;
        }
        return false;
    }

    function render(now) {
        var anyVisible = false;
        var frag = null;
        for (var n = 0; n < state.order.length; n++) {
            var e = state.entries[state.order[n]];
            if (!e.tr) buildRow(e);
            var visible = matchesFilter(e) && (!state.onlyChanging || now - e.lastChange < CHANGING_WINDOW_MS);
            if (visible !== e.visible) {
                e.visible = visible;
                e.tr.hidden = !visible;
            }
            if (e.needsInsert) {
                e.needsInsert = false;
                var nextKey = null;
                for (var m = n + 1; m < state.order.length; m++) {
                    var cand = state.entries[state.order[m]];
                    if (cand.tr && cand.tr.parentNode) { nextKey = cand; break; }
                }
                els.rows.insertBefore(e.tr, nextKey ? nextKey.tr : null);
            }
            var isSel = e.key === state.selected;
            if (isSel !== e.shown.sel) { e.tr.classList.toggle("sel", isSel); e.shown.sel = isSel; }
            if (!visible) continue;
            anyVisible = true;
            var hz = String(e.hz);
            if (hz !== e.shown.hz) { e.cells.hz.textContent = hz; e.shown.hz = hz; }
            var cnt = String(e.count);
            if (cnt !== e.shown.cnt) { e.cells.cnt.textContent = cnt; e.shown.cnt = cnt; }
            for (var i = 0; i < 8; i++) {
                var txt = i < e.data.length ? hex2(e.data[i]) : "";
                if (txt !== e.shown.bytes[i]) { e.cells.bytes[i].textContent = txt; e.shown.bytes[i] = txt; }
                var flash = now - e.changedAt[i] < CHANGE_FLASH_MS && e.changedAt[i] > 0;
                if (flash !== e.shown.flash[i]) { e.cells.bytes[i].classList.toggle("chg", flash); e.shown.flash[i] = flash; }
            }
        }
        els.empty.hidden = state.order.length > 0 && (anyVisible || state.filterTerms.length > 0 || state.onlyChanging);
        if (!state.order.length) els.empty.hidden = false;
        els.nomatch.hidden = !(state.order.length > 0 && !anyVisible);
        renderDetail(now);
        renderCompare();
    }

    // ---- compare ------------------------------------------------------------------------------

    var CMP_BITS_MAX = 16;
    var cmpShown = "";
    var CMP_STATUS_IDLE = "Capture a baseline, then press a button or open a door in the car. The IDs and bits that changed show up here.";

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function hexList(bytes, markFrom) {
        var out = [];
        for (var i = 0; i < bytes.length; i++) {
            var t = hex2(bytes[i]);
            out.push(markFrom && markFrom(i) ? '<span class="chg">' + t + "</span>" : t);
        }
        return out.join(" ");
    }

    // Bits that differ, as dX.Y with the Fiat position (byte*8 + bit counted from the other end), like the desktop Compare.
    function changedBits(base, cur) {
        var out = [];
        var n = Math.max(base.length, cur.length);
        for (var i = 0; i < n; i++) {
            var diff = (base[i] || 0) ^ (cur[i] || 0);
            for (var bit = 0; bit < 8; bit++) {
                if (diff & (1 << bit)) out.push("d" + i + "." + bit + "\u00b7b" + ((7 - i) * 8 + bit));
            }
        }
        return out;
    }

    function sameBytes(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
    }

    function renderCompare() {
        if (!state.baseline) return;
        var onlyChanged = els.cmpOnlyChanged.checked;
        var rows = [];
        var changed = 0;
        for (var n = 0; n < state.order.length; n++) {
            var key = state.order[n];
            var e = state.entries[key];
            var base = state.baseline[key];
            var label = e.id + (e.bus ? " " + e.bus : "");
            if (!base) {
                changed++;
                rows.push({ rank: 1, id: e.idValue, status: "NEW", label: label, base: "", cur: hexList(e.data), bits: "d0\u2013d" + (e.data.length - 1) });
            } else if (!sameBytes(base, e.data)) {
                changed++;
                var bits = changedBits(base, e.data);
                var txt = bits.slice(0, CMP_BITS_MAX).join(", ") + (bits.length > CMP_BITS_MAX ? " (+" + (bits.length - CMP_BITS_MAX) + " more)" : "");
                rows.push({ rank: 0, id: e.idValue, status: "CHANGED", label: label, base: hexList(base), cur: hexList(e.data, function (i) { return base[i] !== e.data[i]; }), bits: txt });
            } else if (!onlyChanged) {
                rows.push({ rank: 2, id: e.idValue, status: "same", label: label, base: hexList(base), cur: hexList(e.data), bits: "" });
            }
        }
        rows.sort(function (x, y) { return x.rank - y.rank || x.id - y.id; });
        var html = "";
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            html += '<tr class="' + r.status.toLowerCase() + '"><td class="mono idc">' + esc(r.label) + '</td><td>' + r.status +
                '</td><td class="mono">' + r.base + '</td><td class="mono">' + r.cur + '</td><td class="mono small">' + esc(r.bits) + "</td></tr>";
        }
        if (html !== cmpShown) { els.cmpRows.innerHTML = html; cmpShown = html; }
        var status = "Baseline: " + Object.keys(state.baseline).length + " IDs frozen \u00b7 Changed or new: " + changed;
        if (els.cmpStatus.textContent !== status) els.cmpStatus.textContent = status;
    }

    function captureBaseline() {
        var snap = Object.create(null);
        for (var n = 0; n < state.order.length; n++) {
            var e = state.entries[state.order[n]];
            snap[e.key] = e.data.slice();
        }
        state.baseline = snap;
        usage.compare = true;
        els.cmpReset.disabled = false;
        cmpShown = "";
        track("webui_compare_capture");
        renderCompare();
    }

    function resetBaseline() {
        state.baseline = null;
        cmpShown = "";
        els.cmpRows.textContent = "";
        els.cmpReset.disabled = true;
        els.cmpStatus.textContent = CMP_STATUS_IDLE;
    }

    // ---- detail panel -------------------------------------------------------------------------

    var detail = { built: false, rows: [], key: null, histShown: -1, title: "" };

    function buildDetail() {
        for (var i = 0; i < 8; i++) {
            var row = document.createElement("div");
            row.className = "bitrow";
            var lbl = document.createElement("span");
            lbl.className = "lbl mono";
            lbl.textContent = "d" + i;
            var hx = document.createElement("span");
            hx.className = "hx mono";
            row.appendChild(lbl);
            row.appendChild(hx);
            var bits = [];
            for (var k = 0; k < 8; k++) {
                var b = document.createElement("span");
                b.className = "bit mono";
                row.appendChild(b);
                bits.push({ el: b, txt: "", flash: false });
            }
            els.dBits.appendChild(row);
            detail.rows.push({ row: row, hx: hx, hxTxt: "", bits: bits, shown: true });
        }
        detail.built = true;
    }

    function renderDetail(now) {
        var e = state.selected ? state.entries[state.selected] : null;
        if (!e) { els.detail.hidden = true; return; }
        els.detail.hidden = false;
        if (!detail.built) buildDetail();
        var title = "ID " + e.id + (e.bus ? " \u00b7 " + e.bus : "") + " \u00b7 " + e.data.length +
            " bytes \u00b7 " + e.hz + " Hz \u00b7 " + e.count + " frames";
        if (title !== detail.title) { els.dTitle.textContent = title; detail.title = title; }
        for (var i = 0; i < 8; i++) {
            var r = detail.rows[i];
            var present = i < e.data.length;
            if (present !== r.shown) { r.row.hidden = !present; r.shown = present; }
            if (!present) continue;
            var v = e.data[i];
            var hx = hex2(v);
            if (hx !== r.hxTxt) { r.hx.textContent = hx; r.hxTxt = hx; }
            var recent = e.changedAt[i] > 0 && now - e.changedAt[i] < CHANGE_FLASH_MS;
            for (var k = 0; k < 8; k++) {
                var bit = (v >> (7 - k)) & 1;
                var c = r.bits[k];
                var t = String(bit);
                if (t !== c.txt) { c.el.textContent = t; c.el.classList.toggle("on", bit === 1); c.txt = t; }
                var fl = recent && ((e.lastXor[i] >> (7 - k)) & 1) === 1;
                if (fl !== c.flash) { c.el.classList.toggle("chg", fl); c.flash = fl; }
            }
        }
        if (detail.key !== e.key || detail.histShown !== e.histVersion) {
            detail.key = e.key;
            detail.histShown = e.histVersion;
            els.dHist.textContent = "";
            for (var h = 0; h < e.history.length; h++) {
                var li = document.createElement("li");
                var tm = document.createElement("span");
                tm.className = "tm";
                tm.textContent = new Date(e.history[h].wall).toLocaleTimeString([], { hour12: false });
                var by = document.createElement("span");
                by.className = "mono";
                by.textContent = e.history[h].bytes.map(hex2).join(" ");
                li.appendChild(tm);
                li.appendChild(by);
                els.dHist.appendChild(li);
            }
        }
    }

    // A timer, not requestAnimationFrame: it keeps the table current in a background tab as well.
    setInterval(function () {
        if (!state.paused) render(performance.now());
    }, RENDER_EVERY_MS);

    // per-second statistics
    setInterval(function () {
        els.fps.textContent = String(state.framesThisSecond);
        state.framesThisSecond = 0;
        for (var i = 0; i < state.order.length; i++) {
            var e = state.entries[state.order[i]];
            e.hz = e.count - e.lastCount;
            e.lastCount = e.count;
        }
        els.ids.textContent = String(state.order.length);
        if (noFramesNote && state.totalFrames > 0) { noFramesNote = false; showNote(""); }
    }, 1000);

    // ---- sources ------------------------------------------------------------------------------

    function setStatus(text, ok) {
        els.status.textContent = text;
        els.status.classList.toggle("ok", !!ok);
    }

    function resetData() {
        state.entries = Object.create(null);
        state.order = [];
        state.totalFrames = 0;
        state.rejected = 0;
        state.splitter = new P.LineSplitter();
        els.rows.textContent = "";
        state.selected = null;
        resetBaseline();
        detail.key = null;
        detail.histShown = -1;
        els.detail.hidden = true;
        els.nomatch.hidden = true;
        els.ids.textContent = "0";
        els.fps.textContent = "0";
        els.empty.hidden = false;
    }

    function setControls(active) {
        els.filter.disabled = !active;
        els.onlyChanging.disabled = !active;
        els.pause.disabled = !active;
        els.cmpCapture.disabled = !active;
        if (!active) els.cmpReset.disabled = !state.baseline;
    }

    function showNote(text) {
        els.note.textContent = text || "";
        els.note.hidden = !text;
    }

    // Replies from the device that are not CAN frames (speed reports, detect result).
    function onDeviceLine(text) {
        var m = /(?:speed:|detected at|set to)\s*(\d+)\s*bps/i.exec(text);
        if (m) {
            var kbit = String(Math.round(parseInt(m[1], 10) / 1000));
            for (var i = 0; i < els.speed.options.length; i++) {
                if (els.speed.options[i].value === kbit) els.speed.value = kbit;
            }
            if (state.source && state.source.name === "USB") setStatus("USB connected \u00b7 CAN " + kbit + " kbit/s", true);
            return true;
        }
        if (/^ERR no CAN traffic/i.test(text)) {
            showNote("No CAN traffic at any supported speed. Check the wiring and that the car is awake.");
            if (state.source && state.source.name === "USB") setStatus("USB connected", true);
            return true;
        }
        return /^(CONNECTED|Detecting vehicle CAN)/i.test(text);
    }

    // UI part of stopping: shared by a user stop and by an unplugged cable.
    function uiStopped() {
        clearTimeout(noFramesTimer);
        noFramesNote = false;
        state.paused = false;
        els.pause.textContent = "Pause";
        els.pause.setAttribute("aria-pressed", "false");
        els.sim.textContent = "Simulator";
        els.sim.setAttribute("aria-pressed", "false");
        els.connect.textContent = "Connect USB";
        els.speed.disabled = true;
        els.detect.disabled = true;
        setControls(false);
        setStatus("Not connected", false);
    }

    function stopSource() {
        var s = state.source;
        state.source = null;
        if (s) s.stop();
        uiStopped();
    }

    function startSimulator() {
        resetData();
        var q = new URLSearchParams(location.search);
        var rate = parseInt(q.get("simrate"), 10) || 600;
        var sim = new window.CanSim.Simulator(ingestText, { rate: rate });
        sim.start();
        usage.source = "simulator";
        usage.sent = false;
        track("webui_simulator_start");
        state.source = { name: "Simulator", stop: function () { sim.stop(); } };
        els.sim.textContent = "Stop simulator";
        els.sim.setAttribute("aria-pressed", "true");
        setControls(true);
        setStatus("Simulator (made-up data)", true);
    }

    els.sim.addEventListener("click", function () {
        if (state.source && state.source.name === "Simulator") { stopSource(); return; }
        if (state.source) stopSource();
        showNote("");
        startSimulator();
    });

    // ---- USB (Web Serial) ---------------------------------------------------------------------

    var link = null;
    var noFramesTimer = null;
    var noFramesNote = false;

    function usbEnded(reason) {
        if (reason !== "lost" || !state.source || state.source.name !== "USB") return;
        link = null;
        state.source = null;
        uiStopped();
        showNote("USB connection lost. Plug the device back in and press Connect USB.");
        track("webui_usb_lost");
    }

    async function startUsb() {
        showNote("");
        var l = new window.CanSerial.SerialLink({ api: navigator.serial, onText: ingestText, onClose: usbEnded });
        try {
            await l.open();
        } catch (e) {
            if (e.code === "cancelled") {
                setStatus("No port selected", false);
            } else if (e.code === "busy") {
                showNote("Could not open the port. Close the desktop app and any other tab that uses it, then try again.");
                track("webui_connect_error", { reason: "busy" });
            } else {
                showNote("Could not connect: " + (e.message || e.code));
                track("webui_connect_error", { reason: String(e.code || "other") });
            }
            return;
        }
        resetData();
        link = l;
        state.source = { name: "USB", stop: function () { var x = link; link = null; if (x) x.close(); } };
        usage.source = "usb";
        usage.sent = false;
        track("webui_connected");
        els.connect.textContent = "Disconnect";
        els.speed.disabled = false;
        els.detect.disabled = false;
        setControls(true);
        setStatus("USB connected \u00b7 921600 baud", true);
        var restartMsg = "The board restarts once when you connect, so the first moments can be empty.";
        showNote(restartMsg);
        setTimeout(function () { if (els.note.textContent === restartMsg) showNote(""); }, 5000);
        // Opening the port can reset the board: give it time to boot, then say hello and ask for the CAN speed.
        setTimeout(function () {
            if (link !== l) return;
            l.send("CONNECT").then(function () { return l.send("SPEED"); }).catch(function () { /* link closed meanwhile */ });
        }, 900);
        noFramesTimer = setTimeout(function () {
            if (link === l && state.totalFrames === 0) {
                noFramesNote = true;
                showNote("Connected, but no frames yet. Check the CAN wiring, that the car is awake, and the CAN speed above.");
            }
        }, 6000);
    }

    els.connect.addEventListener("click", async function () {
        track("webui_connect_click");
        if (state.source && state.source.name === "USB") { stopSource(); return; }
        if (!navigator.serial) { els.unsupported.hidden = false; return; }
        if (state.source) stopSource();
        els.connect.disabled = true;
        try { await startUsb(); } finally { els.connect.disabled = !navigator.serial; }
    });

    els.speed.addEventListener("change", function () {
        if (link) link.send("SETCAN " + els.speed.value).catch(function () { /* link closed */ });
    });

    els.detect.addEventListener("click", function () {
        if (!link) return;
        showNote("");
        setStatus("Detecting CAN speed\u2026", true);
        link.send("DETECTCAN").catch(function () { /* link closed */ });
    });

    // ---- controls -----------------------------------------------------------------------------

    els.rows.addEventListener("click", function (ev) {
        var tr = ev.target.closest("tr");
        if (!tr || !tr.dataset.key) return;
        state.selected = state.selected === tr.dataset.key ? null : tr.dataset.key;
        if (state.selected) usage.selects++;
        render(performance.now());
    });

    els.cmpCapture.addEventListener("click", captureBaseline);
    els.cmpReset.addEventListener("click", resetBaseline);
    els.cmpOnlyChanged.addEventListener("change", function () { cmpShown = ""; renderCompare(); });

    els.dClose.addEventListener("click", function () {
        state.selected = null;
        render(performance.now());
    });

    els.filter.addEventListener("input", function () {
        usage.filter = true;
        state.filterTerms = els.filter.value.split(/[\s,]+/).map(function (t) { return t.trim().toUpperCase(); }).filter(Boolean);
        render(performance.now());
    });

    els.onlyChanging.addEventListener("click", function () {
        state.onlyChanging = !state.onlyChanging;
        usage.changing = true;
        els.onlyChanging.setAttribute("aria-pressed", String(state.onlyChanging));
        render(performance.now());
    });

    els.pause.addEventListener("click", function () {
        state.paused = !state.paused;
        usage.pause = true;
        els.pause.textContent = state.paused ? "Resume" : "Pause";
        els.pause.setAttribute("aria-pressed", String(state.paused));
        if (!state.paused) render(performance.now());
    });

    if (!navigator.serial) {
        els.unsupported.hidden = false;
        els.connect.disabled = true;
    }

    // test hook for development: window.__can.stats()
    window.__can = {
        stats: function () { return { frames: state.totalFrames, rejected: state.rejected, ids: state.order.length }; },
        select: function (key) { state.selected = key; render(performance.now()); },
        ingest: ingestText,
        textLog: function () { return textLog.slice(); },
        capture: captureBaseline,
        render: function () { render(performance.now()); }
    };
})();

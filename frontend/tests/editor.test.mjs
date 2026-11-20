import test from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/lib/editor/model.js";
import { tokensForBytes, RATES } from "../src/lib/tokens.js";

const media = { id: "m1", name: "a.mp4", kind: "video", duration: 10, width: 1280, height: 720 };
const base = () => M.addMedia(M.newProject(), media);

test("split keeps total length and moves the source offset", () => {
  let p = base();
  const c = M.makeMediaClip(media, { start: 2 });
  p = M.addClip(p, c);
  const { project, ids } = M.splitClip(p, c.id, 6);
  const [a, b] = ids.map((id) => project.clips.find((x) => x.id === id));
  assert.equal(a.dur, 4); assert.equal(b.start, 6); assert.equal(b.dur, 6); assert.equal(b.offset, 4);
  assert.equal(M.projectDuration(project), 12);
  assert.equal(M.splitClip(p, c.id, 2.05).ids, null); // too close to the edge
});

test("trim start/end respect the source", () => {
  let p = base(); const c = M.makeMediaClip(media, { start: 0 }); p = M.addClip(p, c);
  p = M.trimStart(p, c.id, 3); let x = p.clips[0];
  assert.deepEqual([x.start, x.dur, x.offset], [3, 7, 3]);
  p = M.trimEnd(p, c.id, 50); x = p.clips[0];
  assert.equal(x.dur, 7); // cannot extend past the source (offset 3 + dur 7 = 10)
  p = M.trimEnd(p, c.id, 4); assert.equal(p.clips[0].dur, 1);
});

test("clipsAt / drawOrder", () => {
  let p = base();
  p = M.addClip(p, M.makeMediaClip(media, { start: 0 }));
  p = M.addClip(p, M.makeTextClip({ text: "hi", start: 1, dur: 2 }));
  p = M.addClip(p, M.makeTextClip({ text: "cap", start: 1, dur: 2, lane: "caption", type: "caption" }));
  const at = M.clipsAt(p, 1.5);
  assert.deepEqual(M.drawOrder(at).map((c) => c.lane), ["video", "text", "caption"]);
  assert.equal(M.clipsAt(p, 5).length, 1);
});

test("SRT round trip (Khmer + multi-line)", () => {
  const srt = "1\n00:00:00,600 --> 00:00:02,000\nសួស្តី បង\n\n2\n00:00:02,500 --> 00:00:04,000\nline one\nline two\n";
  const cues = M.parseSrt(srt);
  assert.equal(cues.length, 2); assert.equal(cues[1].text, "line one\nline two");
  const clips = M.cuesToTimelineCaptions(cues);
  assert.equal(M.buildSrt(clips), srt);
  assert.deepEqual(M.parseSrt("garbage"), []);
});

test("cues from a trimmed source clip land on the timeline", () => {
  const src = { ...M.makeMediaClip(media, { start: 10 }), offset: 2, dur: 4 }; // uses source 2…6 at timeline 10…14
  const caps = M.cuesToCaptionClips([{ start: 0, end: 1, text: "before" }, { start: 3, end: 5, text: "in" }, { start: 5, end: 9, text: "tail" }], src);
  assert.deepEqual(caps.map((c) => [c.text, c.start, c.dur]), [["in", 11, 2], ["tail", 13, 1]]);
});

test("ttsRateFor speeds up only when speech is too long", () => {
  assert.equal(M.ttsRateFor(2, 3), 0);
  assert.equal(M.ttsRateFor(3, 2), 50);
  assert.equal(M.ttsRateFor(10, 2), 100);
});

test("token cost: whole tokens, rounded up", () => {
  assert.equal(tokensForBytes(1048576, RATES.captionPerMB), 5);
  assert.equal(tokensForBytes(2.12 * 1048576, RATES.captionPerMB), 11);
  assert.equal(tokensForBytes(5 * 1048576, RATES.cloudSharePerMB), 10);
});

// ── real-editor ops ──
import { rippleDelete, cutRange, pointInBox, hitTest, fadeAlpha, removeSilentRanges, makeTextClip as mkText, addClip as addC, newProject as np2, projectDuration as pd2 } from "../src/lib/editor/model.js";
import { applyOps } from "../src/lib/editor/aiOps.js";
import { findSilences } from "../src/lib/editor/silence.js";

test("rippleDelete closes the gap on the same lane only", () => {
  let p = np2();
  const a = mkText({ text: "a", start: 0, dur: 2 }), b = mkText({ text: "b", start: 2, dur: 2 }), cap = mkText({ text: "c", start: 3, dur: 1, lane: "caption", type: "caption" });
  p = addC(addC(addC(p, a), b), cap);
  const r = rippleDelete(p, a.id);
  assert.equal(r.clips.length, 2);
  assert.equal(r.clips.find((c) => c.id === b.id).start, 0);
  assert.equal(r.clips.find((c) => c.id === cap.id).start, 3);
});

test("cutRange removes the middle and keeps both sides", () => {
  let p = np2();
  const a = mkText({ text: "a", start: 0, dur: 10 });
  p = addC(p, a);
  const r = cutRange(p, a.id, 3, 5);
  assert.equal(r.clips.length, 2);
  assert.deepEqual(r.clips.map((c) => [c.start, c.dur]).sort((x, y) => x[0] - y[0]), [[0, 3], [3, 5]]);
  assert.equal(pd2(r), 8);
});

test("hit test honours rotation and draw order", () => {
  const box = { cx: 100, cy: 100, w: 100, h: 20, rot: 90 };
  assert.equal(pointInBox(box, 100, 140), true);
  assert.equal(pointInBox(box, 140, 100), false);
  const hit = hitTest([{ clip: { id: "under" }, box: { cx: 50, cy: 50, w: 100, h: 100, rot: 0 } }, { clip: { id: "top" }, box: { cx: 50, cy: 50, w: 40, h: 40, rot: 0 } }], 50, 50);
  assert.equal(hit.id, "top");
  assert.equal(hitTest([], 1, 1), null);
});

test("fadeAlpha ramps in and out", () => {
  const c = { start: 10, dur: 4, fadeIn: 1, fadeOut: 2 };
  assert.equal(fadeAlpha(c, 10), 0);
  assert.equal(fadeAlpha(c, 10.5), 0.5);
  assert.equal(fadeAlpha(c, 12), 1);
  assert.equal(fadeAlpha(c, 13), 0.5);
});

test("findSilences + removeSilentRanges shorten the project", () => {
  const sr = 1000, s = new Float32Array(sr * 6).fill(0.5);
  s.fill(0, 2 * sr, 4 * sr);
  const sil = findSilences(s, sr, { minSilence: 0.5, pad: 0.1 });
  assert.equal(sil.length, 1);
  assert.ok(sil[0][0] >= 2 && sil[0][1] <= 4 && sil[0][1] - sil[0][0] > 1.5);
  let p = np2();
  p = { ...p, media: { m1: { id: "m1", kind: "video", duration: 6 } }, clips: [{ id: "v", lane: "video", type: "video", mediaId: "m1", start: 0, dur: 6, offset: 0 }] };
  const r = removeSilentRanges(p, "v", sil);
  assert.ok(r.removed > 1.5);
  assert.ok(pd2(r.project) < 4.5);
});

test("applyOps validates and applies AI operations", () => {
  let p = np2();
  const t1 = mkText({ text: "hello", start: 0, dur: 3 });
  p = addC(p, t1);
  const r = applyOps(p, [
    { op: "add_text", text: "Title", start: 1, dur: 2, style: { color: "#ff0000", size: 999 } },
    { op: "update", target: "texts", patch: { y: 0.2, opacity: 9, evil: 1, style: { color: "javascript:1", bold: false } } },
    { op: "update", target: "nope", patch: { y: 0.1 } },
    { op: "split", target: t1.id, at: 1.5 },
    { op: "action", name: "remove_silence" },
    { op: "drop_tables" },
  ], {});
  assert.equal(r.actions[0], "remove_silence");
  assert.ok(r.applied >= 4);
  const title = r.project.clips.find((c) => c.text === "Title");
  assert.equal(title.style.color, "#ff0000");
  assert.equal(title.style.size, 25);
  assert.equal(title.opacity, 1);
  assert.equal(title.style.bold, false);
  assert.ok(r.project.clips.length >= 3);
});

test("caption presets restyle every caption", async () => {
  const { applyCaptionPreset, CAPTION_PRESETS } = await import("../src/lib/editor/model.js");
  let p = np2();
  p = addC(addC(p, mkText({ text: "a", lane: "caption", type: "caption" })), mkText({ text: "t" }));
  const r = applyCaptionPreset(p, CAPTION_PRESETS[1]);
  assert.equal(r.clips[0].style.color, "#facc15");
  assert.equal(r.clips[0].y, 0.86);
  assert.notEqual(r.clips[1].style.color, "#facc15"); // plain text untouched
});

test("word highlight follows time, shares it by word length, and survives caption looks", async () => {
  const M2 = await import("../src/lib/editor/model.js");
  assert.equal(M2.activeWordIndex([2, 2, 4], 0, 8), 0);
  assert.equal(M2.activeWordIndex([2, 2, 4], 2.1, 8), 1);
  assert.equal(M2.activeWordIndex([2, 2, 4], 7.9, 8), 2);
  assert.equal(M2.activeWordIndex([2, 2, 4], 8, 8), -1);
  assert.equal(M2.activeWordIndex([], 1, 8), -1);
  assert.deepEqual(M2.splitWords("hello world").filter((x) => x.word).map((x) => x.s), ["hello", "world"]);
  assert.ok(M2.splitWords("សួស្តី បង").filter((x) => x.word).length >= 2);
  let p = M2.newProject();
  p = M2.addClip(p, M2.makeTextClip({ text: "a b", lane: "caption", type: "caption" }));
  p = M2.setCaptionHighlight(p, true, "#ff0000");
  assert.equal(p.clips[0].style.karaoke, true);
  p = M2.applyCaptionPreset(p, M2.CAPTION_PRESETS[1]);
  assert.equal(p.clips[0].style.karaoke, true);
  assert.equal(p.clips[0].style.hl, "#ff0000");
});

test("audio extraction size estimate (16 kHz mono 16-bit)", async () => {
  const { estimateWavBytes } = await import("../src/lib/editor/extract.js");
  assert.equal(estimateWavBytes(60), 60 * 32000 + 44);
  assert.equal(estimateWavBytes(-5), 44);
});

test("assignTracks: overlapping clips get their own row, sequential clips share one", async () => {
  const { assignTracks } = await import("../src/lib/editor/model.js");
  const clips = [
    { id: "a", lane: "audio", start: 0, dur: 10 },
    { id: "b", lane: "audio", start: 5, dur: 10 },
    { id: "c", lane: "audio", start: 10, dur: 2 },
    { id: "v", lane: "video", start: 0, dur: 4 },
    { id: "w", lane: "video", start: 4, dur: 4 },
  ];
  const { track, rows } = assignTracks(clips);
  assert.equal(track.get("a"), 0); assert.equal(track.get("b"), 1); assert.equal(track.get("c"), 0);
  assert.equal(rows.audio, 2); assert.equal(rows.video, 1); assert.equal(rows.voice, 1);
});

test("peaksFromSamples normalises to 0..1 at 50 buckets/s", async () => {
  const { peaksFromSamples } = await import("../src/lib/editor/waveform.js");
  const rate = 16000, s = new Float32Array(rate * 2);
  for (let i = 0; i < rate; i++) s[i] = 0.5 * Math.sin(i / 10);
  const p = peaksFromSamples(s, rate);
  assert.equal(p.length, 100);
  assert.ok(Math.max(...p) <= 1 && p[10] > 0.9 && p[80] === 0);
});


test("captionView: long captions are shown in short groups that follow the speech", async () => {
  const m = await import("../src/lib/editor/model.js");
  const text = "one two three four five six seven eight nine ten eleven twelve";
  const g = (t, st) => m.captionView(text, t, 12, st);
  assert.equal(g(0, {}).text, text); // no options → whole caption, as before
  const early = g(0.5, { maxChars: 20 }), late = g(11.5, { maxChars: 20 });
  assert.ok(early.text.length <= 20 && late.text.length <= 20 && early.text !== late.text);
  assert.ok(early.text.startsWith("one") && late.text.endsWith("twelve"));
  assert.equal(g(5, { single: true }).text, "six"); // one word at a time
  assert.equal(g(0.1, { reveal: true, maxChars: 20 }).text, "one"); // typewriter: only what was said so far
  assert.equal(g(2.6, { reveal: true, maxChars: 40 }).text, "one two three four");
  assert.equal(g(2.6, { reveal: true, maxChars: 40 }).active, 3);
  assert.equal(g(30, { maxChars: 20 }).active, -1); // after the speech → no highlight, last group stays
  // a group never splits a word and a longer word is its own group
  assert.equal(m.captionView("supercalifragilistic hi", 0, 2, { maxChars: 5 }).text, "supercalifragilistic");
});

test("animFx: entrance animations start hidden/offset and settle at rest", async () => {
  const { animFx, ANIMS } = await import("../src/lib/editor/model.js");
  for (const k of ANIMS) { const end = animFx(k, 5); assert.deepEqual(end, { alpha: 1, scale: 1, dy: 0 }); }
  assert.ok(animFx("fade", 0).alpha < 0.1 && animFx("slide", 0).dy > 0.5 && animFx("zoom", 0).scale > 1.5 && animFx("pop", 0).scale < 0.7);
});

test("highlight templates: gradients, one-word and animated looks; applying one resets the previous", async () => {
  const m = await import("../src/lib/editor/model.js");
  assert.ok(m.HL_TEMPLATES.length >= 24 && new Set(m.HL_TEMPLATES.map((x) => x.id)).size === m.HL_TEMPLATES.length);
  assert.ok(m.HL_TEMPLATES.some((x) => x.look.hlGrad?.length >= 3) && m.HL_TEMPLATES.some((x) => x.look.single) && m.HL_TEMPLATES.some((x) => x.look.reveal));
  const cap = m.makeTextClip({ text: "hi there", lane: "caption", type: "caption", style: { ...m.DEFAULT_CAPTION_STYLE } });
  let p = { ...m.newProject(), clips: [cap], captionStyle: { ...m.DEFAULT_CAPTION_STYLE } };
  p = m.applyHighlightTemplate(p, m.HL_TEMPLATES.find((x) => x.id === "oneword"));
  assert.equal(p.clips[0].style.single, true);
  p = m.applyHighlightTemplate(p, m.HL_TEMPLATES.find((x) => x.id === "bluegrad"));
  assert.equal(p.clips[0].style.single, false);
  assert.equal(p.clips[0].style.anim, "none");
  assert.equal(p.clips[0].style.hlGrad.length, 3);
  p = m.applyHighlightTemplate(p, m.HL_TEMPLATES.find((x) => x.id === "classic"));
  assert.equal(p.clips[0].style.hlGrad, null);
  assert.ok(m.DEFAULT_CAPTION_STYLE.maxChars > 0); // new captions are short by default
  p = m.applyCaptionPreset(p, m.CAPTION_PRESETS[1]);
  assert.equal(p.clips[0].style.maxChars, m.DEFAULT_CAPTION_STYLE.maxChars); // a look keeps the grouping
});

test("multi-select operations: move / delete / lock / paste / range / crop", async () => {
  const m = await import("../src/lib/editor/model.js");
  const mk = (id, start, lane = "text") => ({ id, type: "text", lane, start, dur: 2, text: id, style: {} });
  let p = { ...m.newProject(), clips: [mk("a", 1), mk("b", 4), mk("c", 8, "caption")] };
  p = m.moveClips(p, ["a", "b"], -5); // the group stops at 0, spacing kept
  assert.deepEqual(p.clips.map((c) => c.start), [0, 3, 8]);
  p = m.lockClips(p, ["b"], true);
  assert.equal(m.moveClips(p, ["a", "b"], 2).clips.find((c) => c.id === "b").start, 3); // locked clip stays
  assert.equal(m.removeClips(p, ["a", "b"]).clips.length, 2); // …and survives a bulk delete
  assert.equal(m.updateClips(p, ["a", "b"], { opacity: 0.5 }).clips.filter((c) => c.opacity === 0.5).length, 1);
  const r = m.pasteClips(p, p.clips.slice(0, 2), 10);
  assert.deepEqual(r.project.clips.slice(3).map((c) => c.start), [10, 13]); // relative timing kept
  assert.ok(r.project.clips.slice(3).every((c) => !c.locked && c.id !== "a" && c.id !== "b"));
  assert.deepEqual(m.clipsInRange(p, 2.5, 3.5, ["text"]), ["b"]);
  assert.deepEqual(m.clipsInRange(p, 0, 20, ["caption"]), ["c"]);
  const cr = m.cropRect({ cropL: 0.1, cropR: 0.2, cropT: 0, cropB: 0.5 }, 1000, 500);
  assert.deepEqual([cr.sx, cr.sy, cr.sw, cr.sh], [100, 0, 700, 250]);
  assert.ok(Math.abs(m.cropRect({ cropL: 5 }, 100, 100).sw - 10) < 1e-9); // clamped: never fully cropped away
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate as nativeImmediate } from "node:timers";
import ts from "typescript";

// Exercise the shipped engine rather than a second implementation of its queue.
const source = readFileSync(new URL("../components/cake-sequence-engine.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { createCakeSequenceEngine } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const GLOBALS = [
  "performance", "setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame",
  "window", "document", "ResizeObserver", "IntersectionObserver", "HTMLImageElement",
  "ImageBitmap", "createImageBitmap", "fetch",
];
const drainMicrotasks = () => new Promise(resolve => nativeImmediate(resolve));

/** A virtual browser clock: fetch and decode resolve independently, and decoding is unabortable. */
function browser(t, options = {}) {
  const originalGlobals = new Map(GLOBALS.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const install = (key, value) => Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  let now = 0, nextID = 0, state = "loading", engine;
  let activeFetches = 0, activeDecodes = 0, visibleFrame = null;
  const tasks = new Map(), requests = [], bitmaps = [], paints = [], reads = new Map();
  const resizeObservers = [], intersectionObservers = [], states = [];
  const failures = new Map(Object.entries(options.failures ?? {}));
  const maxima = { fetches: 0, decodes: 0, bitmaps: 0, cache: 0, encodedBytes: 0, encodedCache: 0 };
  const style = () => {
    const values = new Map();
    return { values, setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) };
  };
  const stage = { style: style() }, wrapper = { style: style() };
  const schedule = (fn, delay, kind = "timer") => {
    const id = ++nextID;
    tasks.set(id, { due: now + Math.max(0, delay), fn, kind });
    return id;
  };
  const cancel = id => tasks.delete(id);
  install("performance", { now: () => now });
  install("setTimeout", (fn, delay = 0) => schedule(fn, delay));
  install("clearTimeout", cancel);
  install("requestAnimationFrame", fn => schedule(() => fn(now), 16 - now % 16, "raf"));
  install("cancelAnimationFrame", cancel);
  install("window", Object.assign(new EventTarget(), {
    devicePixelRatio: 1, matchMedia: () => ({ matches: false }), setTimeout: globalThis.setTimeout,
  }));
  install("ResizeObserver", class {
    constructor(fn) { this.fn = fn; this.disconnected = false; resizeObservers.push(this); }
    observe() { this.fn(); }
    disconnect() { this.disconnected = true; }
  });
  install("IntersectionObserver", class {
    constructor(fn) { this.fn = fn; this.disconnected = false; intersectionObservers.push(this); }
    observe() { this.fn([{ isIntersecting: true }]); }
    disconnect() { this.disconnected = true; }
  });
  install("HTMLImageElement", class {});
  install("ImageBitmap", class {
    constructor(record) {
      this.record = record; this.width = 2560; this.height = 1440; this.closed = false;
      bitmaps.push(this);
      maxima.bitmaps = Math.max(maxima.bitmaps, bitmaps.filter(bitmap => !bitmap.closed).length);
    }
    close() { this.closed = true; }
  });
  let sampled;
  const sampler = {
    clearRect() {},
    drawImage(bitmap, ...coordinates) {
      assert.equal(coordinates.length, 8, "sample one cropped pixel rather than the entire image");
      assert.deepEqual(coordinates.slice(-4), [0, 0, 1, 1]);
      sampled = bitmap;
    },
    getImageData() {
      reads.set(sampled, (reads.get(sampled) ?? 0) + 1);
      return { data: sampled.record.theme === "dark" ? [27, 15, 15, 255] : [250, 240, 234, 255] };
    },
  };
  const document = Object.assign(new EventTarget(), {
    hidden: false, createElement: () => ({ width: 1, height: 1, getContext: () => sampler }),
  });
  install("document", document);
  install("fetch", (url, { signal }) => {
    const match = String(url).match(/\/ivory-cake\/(dark|light)\/(?:1280|2560|3840)\/(\d{3})\.webp$/);
    assert.ok(match, `unexpected frame request: ${url}`);
    const key = `${match[1]}:${Number(match[2])}`;
    const failed = (failures.get(key) ?? 0) > 0;
    if (failed) failures.set(key, failures.get(key) - 1);
    const record = { id: requests.length, url, index: Number(match[2]), theme: match[1], at: now, signal, failed, aborted: false, fetched: false, decoded: false };
    requests.push(record);
    activeFetches++;
    maxima.fetches = Math.max(maxima.fetches, activeFetches);
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = () => { if (!finished) { finished = true; activeFetches--; } };
      const id = schedule(() => {
        signal.removeEventListener("abort", abort); finish(); record.fetched = true;
        if (failed) { resolve(new Response("Temporarily unavailable", { status: 503 })); return; }
        const payload = JSON.stringify({ id: record.id }).padEnd(options.frameBytes ?? 64, " ");
        resolve(new Response(payload, { headers: { "content-type": "image/webp", "content-length": String(payload.length) } }));
      }, options.fetchLatency ?? 0, "fetch");
      const abort = () => {
        record.aborted = true; cancel(id); finish(); reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    });
  });
  install("createImageBitmap", async blob => {
    const record = requests[JSON.parse(await blob.text()).id];
    activeDecodes++;
    maxima.decodes = Math.max(maxima.decodes, activeDecodes);
    const delay = typeof options.decodeLatency === "function" ? options.decodeLatency(record) : options.decodeLatency ?? 0;
    // Native createImageBitmap has no abort argument. Late results must be closed by the engine.
    return new Promise(resolve => schedule(() => {
      activeDecodes--; record.decoded = true;
      resolve(new ImageBitmap(record));
    }, delay, "decode"));
  });
  const context = {
    globalAlpha: 1, fillStyle: "", setTransform() {}, fillRect() {},
    drawImage(bitmap) {
      assert.equal(bitmap.closed, false, "released images must never be drawn");
      if (this.globalAlpha <= 0) return;
      visibleFrame = bitmap.record.index;
      paints.push({ index: visibleFrame, theme: bitmap.record.theme, at: now, fill: this.fillStyle });
    },
  };
  const canvas = {
    dataset: {}, clientWidth: 1280, clientHeight: 720, getContext: () => context,
    closest: selector => selector === ".gd-cinema" ? stage : wrapper,
  };
  const sampleDiagnostics = () => {
    maxima.cache = Math.max(maxima.cache, Number(canvas.dataset.cacheSize) || 0);
    maxima.encodedBytes = Math.max(maxima.encodedBytes, Number(canvas.dataset.encodedBytes) || 0);
    maxima.encodedCache = Math.max(maxima.encodedCache, Number(canvas.dataset.encodedCacheSize) || 0);
  };
  async function advance(target) {
    assert.ok(target >= now, "virtual time must move forward");
    await drainMicrotasks();
    let count = 0;
    while (true) {
      assert.ok(++count < 20000, "engine must not schedule an unbounded work loop");
      const next = [...tasks].filter(([, task]) => task.due <= target)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      now = next[1].due; tasks.delete(next[0]); next[1].fn();
      await drainMicrotasks(); sampleDiagnostics();
    }
    now = target; await drainMicrotasks(); sampleDiagnostics();
  }
  engine = createCakeSequenceEngine(canvas, {
    progress: (options.initialIndex ?? 0) / 89, theme: "dark", paused: true,
    onState(next, theme) { state = next; states.push({ state, theme, at: now }); },
  });
  t.after(() => {
    try { engine.dispose(); }
    finally {
      for (const [key, descriptor] of originalGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
      }
    }
  });
  return {
    engine, canvas, context, stage, wrapper, requests, bitmaps, paints, reads, maxima, tasks,
    resizeObservers, intersectionObservers, states, advance,
    get now() { return now; }, get state() { return state; }, get visibleFrame() { return visibleFrame; },
    get activeDecodes() { return activeDecodes; },
  };
}

function assertBounded(sim) {
  assert.ok(sim.maxima.fetches <= 3, `active fetches: ${sim.maxima.fetches}`);
  assert.ok(sim.maxima.decodes <= 2, `active decodes: ${sim.maxima.decodes}`);
  assert.ok(sim.maxima.cache <= 6, `decoded cache: ${sim.maxima.cache}`);
  assert.ok(sim.maxima.bitmaps <= 8, `cached images plus in-flight decoded results: ${sim.maxima.bitmaps}`);
  assert.ok(sim.maxima.encodedBytes <= 2 * 1024 * 1024, `encoded bytes: ${sim.maxima.encodedBytes}`);
  assert.ok(sim.maxima.encodedCache <= 24, `encoded entries: ${sim.maxima.encodedCache}`);
}

test("cold scrolling advances before stopping when loading is slower than target changes", async t => {
  const sim = browser(t, { fetchLatency: 90, decodeLatency: 30 });
  for (let index = 0; index <= 60; index++) {
    await sim.advance(index * 30);
    sim.engine.setProgress(index / 89);
  }
  await sim.advance(1816);
  const displayed = new Set(sim.paints.map(paint => paint.index));
  assert.ok(displayed.size >= 3, `scrolling displayed only ${[...displayed]}`);
  assert.ok(sim.visibleFrame >= 45, `cold scrolling remained at frame ${sim.visibleFrame}`);
  const scrolling = { visibleFrame: sim.visibleFrame, distinctFrames: displayed.size, started: sim.requests.length, aborted: sim.requests.filter(request => request.aborted).length };
  await sim.advance(2400);
  assert.equal(sim.visibleFrame, 60, "the last target must paint after pending work settles");
  assert.equal(sim.state, "ready");
  assertBounded(sim);
  t.diagnostic(JSON.stringify({ coldScroll: scrolling, settledFrame: sim.visibleFrame, maxFetches: sim.maxima.fetches, maxDecodes: sim.maxima.decodes }));
});

test("two temporary failures recover on a later visit after the retry cooldown", async t => {
  const sim = browser(t, { initialIndex: 43, failures: { "dark:43": 2 }, fetchLatency: 30, decodeLatency: 20 });
  await sim.advance(2000);
  assert.equal(sim.requests.filter(request => request.index === 43).length, 2, "retry attempts must stay bounded within the cooldown");
  sim.engine.setProgress(42 / 89);
  await sim.advance(2600);
  await sim.advance(6200);
  sim.engine.setProgress(43 / 89);
  await sim.advance(6800);
  assert.ok(sim.requests.filter(request => request.index === 43).length >= 3, "temporary failures must not blacklist a frame forever");
  assert.equal(sim.visibleFrame, 43);
  assert.equal(sim.state, "ready");
  assertBounded(sim);
});

test("decoded cache eviction permits repeated visits and keeps encoded storage bounded", async t => {
  const sim = browser(t, { fetchLatency: 30, decodeLatency: 20, frameBytes: 150 * 1024 });
  let zeroVisits = 0;
  for (let cycle = 0; cycle < 4; cycle++) {
    for (const index of [0, 20, 40, 60, 80]) {
      sim.engine.setProgress(index / 89);
      await sim.advance(sim.now + 600);
      assert.equal(sim.visibleFrame, index, `visit ${cycle + 1} to ${index} must paint its exact frame`);
      if (index === 0) zeroVisits++;
    }
  }
  assert.equal(zeroVisits, 4);
  assertBounded(sim);
  assert.ok([...sim.reads.values()].every(count => count === 1), "sample background once per decoded resource");
});

test("theme changes discard late decoded images and restore poster backgrounds", async t => {
  const sim = browser(t, {
    initialIndex: 42, fetchLatency: 0, decodeLatency: request => request.theme === "dark" ? 200 : 20,
  });
  await sim.advance(32);
  assert.ok(sim.activeDecodes > 0, "the old theme must have pending decode work for this regression");
  sim.engine.setTheme("light");
  assert.equal(sim.stage.style.values.has("--gd-render-bg"), false);
  assert.equal(sim.wrapper.style.values.has("--gd-render-bg"), false);
  await sim.advance(600);
  assert.ok(sim.paints.length > 0);
  assert.ok(sim.paints.every(paint => paint.theme === "light"), "late old-theme results must never paint");
  assert.ok(sim.bitmaps.filter(bitmap => bitmap.record.theme === "dark").every(bitmap => bitmap.closed));
  assert.equal(sim.stage.style.values.get("--gd-render-bg"), "rgb(250,240,234)");
  assert.equal(sim.wrapper.style.values.get("--gd-render-bg"), "rgb(250,240,234)");
  sim.engine.setTheme("dark");
  assert.equal(sim.stage.style.values.has("--gd-render-bg"), false);
  assert.equal(sim.wrapper.style.values.has("--gd-render-bg"), false);
  assertBounded(sim);
});

test("paint diagnostics update promptly after a cache-only frame change", async t => {
  const sim = browser(t, { initialIndex: 40 });
  await sim.advance(200);
  sim.engine.setProgress(39 / 89);
  await sim.advance(400);
  assert.equal(sim.visibleFrame, 39);
  const before = sim.requests.length;
  sim.engine.setPaused(false);
  sim.engine.setPaused(true);
  sim.engine.setProgress(40 / 89);
  await sim.advance(448);
  assert.equal(sim.requests.length, before, "this regression must exercise a paint with no fetch completion");
  assert.equal(sim.visibleFrame, 40);
  assert.equal(Number(sim.canvas.dataset.frameIndex), 40);
  assert.ok(Math.abs(Number(sim.canvas.dataset.progress) - 40 / 89) < 0.001);
  await sim.advance(1000);
  assert.equal(Number(sim.canvas.dataset.frameIndex), 40);
});

test("dispose cancels scheduled work, clears overrides, and closes late decode results", async t => {
  const sim = browser(t, { initialIndex: 42, fetchLatency: 30, decodeLatency: 200 });
  await sim.advance(64);
  assert.ok(sim.activeDecodes > 0);
  const requestsAtDispose = sim.requests.length;
  sim.engine.dispose();
  sim.engine.dispose();
  assert.equal(sim.stage.style.values.has("--gd-render-bg"), false);
  assert.equal(sim.wrapper.style.values.has("--gd-render-bg"), false);
  assert.ok(sim.resizeObservers.every(observer => observer.disconnected));
  assert.ok(sim.intersectionObservers.every(observer => observer.disconnected));
  assert.equal([...sim.tasks.values()].filter(task => task.kind === "raf").length, 0);
  await sim.advance(1000);
  assert.equal(sim.requests.length, requestsAtDispose, "disposed work must not fetch more frames");
  assert.ok(sim.bitmaps.every(bitmap => bitmap.closed), "late decode resources must also be released");
  assert.equal(sim.tasks.size, 0, "fetch timeouts and retry timers must be cleaned up");
});

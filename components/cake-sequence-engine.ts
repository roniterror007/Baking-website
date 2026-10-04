export type CakeTheme = "dark" | "light";
export type SequenceState = "loading" | "ready" | "fallback";
export type CakeSequenceEngine = {
  setProgress(value: number): void;
  setTheme(value: CakeTheme): void;
  setPaused(value: boolean): void;
  dispose(): void;
};
type Options = { progress: number; theme: CakeTheme; paused: boolean; onState(state: SequenceState, theme: CakeTheme): void };
type Source = ImageBitmap | HTMLImageElement;
type RGB = readonly [number, number, number];
type Entry = { source: Source; background: RGB; index: number; touched: number };
type EncodedEntry = { blob: Blob; index: number; touched: number };
type FetchJob = { controller: AbortController; epoch: number; timer: number; timedOut: boolean };
type DecodeJob = { controller: AbortController; epoch: number };
type Failure = { count: number; retryAt: number };
const FRAME_COUNT = 90, CACHE_LIMIT = 6, ENCODED_LIMIT = 24, BYTE_LIMIT = 2 * 1024 * 1024;
const FETCH_LIMIT = 3, DECODE_LIMIT = 2, LOOKAHEAD = 4, MAX_DECODE_DISTANCE = 6;
const MAX_FAILURES = 2, RETRY_DELAY = 700, RETRY_COOLDOWN = 5000, FETCH_TIMEOUT = 10000;
const BACKGROUND = { dark: "#18110e", light: "#f7f2e9" };
const FALLBACK_RGB: Record<CakeTheme, RGB> = { dark: [24, 17, 14], light: [247, 242, 233] };
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
const smoothstep = (value: number) => { const amount = clamp(value); return amount * amount * (3 - 2 * amount); };
const displayZoom = (value: number) => value < 0.42 ? 1.15 - 0.15 * smoothstep(value / 0.42) : value > 0.55 ? 1 + 0.15 * smoothstep((value - 0.55) / 0.45) : 1;

function release(source: Source) {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();
  else (source as HTMLImageElement).removeAttribute("src");
}
async function fetchBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal, credentials: "same-origin" });
  if (!response.ok || !response.body) throw new Error("Frame unavailable");
  if (Number(response.headers.get("content-length")) > BYTE_LIMIT) { await response.body.cancel(); throw new Error("Frame too large"); }
  const reader = response.body.getReader(), parts: ArrayBuffer[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > BYTE_LIMIT) throw new Error("Frame too large");
      parts.push(result.value.slice().buffer);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  signal.throwIfAborted();
  return new Blob(parts, { type: "image/webp" });
}
async function decodeFrame(blob: Blob, signal: AbortSignal): Promise<Source> {
  signal.throwIfAborted();
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      if (signal.aborted) { bitmap.close(); signal.throwIfAborted(); }
      return bitmap;
    } catch (error) { if (signal.aborted) throw error; }
  }
  const objectURL = URL.createObjectURL(blob), image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const aborted = () => { image.removeAttribute("src"); reject(new DOMException("Aborted", "AbortError")); };
      signal.addEventListener("abort", aborted, { once: true });
      image.onload = () => { signal.removeEventListener("abort", aborted); resolve(); };
      image.onerror = () => { signal.removeEventListener("abort", aborted); reject(new Error("Frame decode failed")); };
      image.src = objectURL;
    });
    signal.throwIfAborted();
    return image;
  } catch (error) { image.removeAttribute("src"); throw error; }
  finally { image.onload = image.onerror = null; URL.revokeObjectURL(objectURL); }
}

export function createCakeSequenceEngine(canvas: HTMLCanvasElement, options: Options): CakeSequenceEngine {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas unavailable");
  const ctx = context;
  const sampleCanvas = document.createElement("canvas"); sampleCanvas.width = sampleCanvas.height = 1;
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  const stage = canvas.closest<HTMLElement>(".gd-cinema"), wrapper = canvas.closest<HTMLElement>(".cake-sequence-scene");
  let theme = options.theme, progress = clamp(options.progress), paused = options.paused;
  let fillColor = BACKGROUND[theme], renderedBackground = false;
  let disposed = false, visible = false, epoch = 0, frame = 0, retryTimer = 0, retryDue = 0;
  let resolution: 1280 | 2560 | 3840 = 1280, width = 1, height = 1, dpr = 1, direction = 1;
  let clock = 0, lastTime = 0, paintCount = 0, lastDiagnostic = 0, idleFraction = 0, encodedBytes = 0;
  let currentIndex = Math.round(progress * (FRAME_COUNT - 1)), lastPainted = -1, paintedSignature = "";
  let state: SequenceState = "loading", stateTheme = theme;
  const cache = new Map<number, Entry>(), encoded = new Map<number, EncodedEntry>();
  const fetches = new Map<number, FetchJob>(), decodes = new Map<number, DecodeJob>(), failures = new Map<number, Failure>();
  const listeners: { target: EventTarget; type: string; fn: EventListener }[] = [];
  const listen = (target: EventTarget, type: string, fn: EventListener) => { target.addEventListener(type, fn); listeners.push({ target, type, fn }); };
  const canRun = () => !disposed && visible && !document.hidden;
  const resetBackground = () => {
    if (renderedBackground) { stage?.style.removeProperty("--gd-render-bg"); wrapper?.style.removeProperty("--gd-render-bg"); }
    renderedBackground = false; fillColor = BACKGROUND[theme];
  };
  const sampleBackground = (source: Source): RGB => {
    try {
      if (!sampleContext) return FALLBACK_RGB[theme];
      sampleContext.clearRect(0, 0, 1, 1);
      const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      // The first WebP pixel can be a chroma outlier; the clear mid-edge matches the stage.
      sampleContext.drawImage(source, 0, Math.floor(sourceHeight / 2), 1, 1, 0, 0, 1, 1);
      const pixel = sampleContext.getImageData(0, 0, 1, 1).data;
      return pixel[3] === 255 ? [pixel[0], pixel[1], pixel[2]] : FALLBACK_RGB[theme];
    } catch { return FALLBACK_RGB[theme]; }
  };
  const matchBackground = (rgb: RGB) => {
    const value = `rgb(${rgb.join(",")})`;
    if (renderedBackground && fillColor === value) return;
    fillColor = value; renderedBackground = true;
    stage?.style.setProperty("--gd-render-bg", value); wrapper?.style.setProperty("--gd-render-bg", value);
  };
  const report = (next: SequenceState) => {
    if (next !== "ready") { resetBackground(); paintedSignature = ""; canvas.dataset.painted = "false"; }
    if (state !== next || stateTheme !== theme) { state = next; stateTheme = theme; options.onState(next, theme); }
  };
  const diagnostics = (force = false) => {
    const now = performance.now();
    if (!force && now - lastDiagnostic < 100) return;
    lastDiagnostic = now;
    canvas.dataset.engine = "rendered-3d-sequence";
    canvas.dataset.frameIndex = String(lastPainted);
    canvas.dataset.paintCount = String(paintCount);
    canvas.dataset.resolution = String(resolution);
    canvas.dataset.progress = progress.toFixed(4);
    canvas.dataset.cacheSize = String(cache.size);
    canvas.dataset.encodedCacheSize = String(encoded.size);
    canvas.dataset.encodedBytes = String(encodedBytes);
    canvas.dataset.fetchCount = String(fetches.size);
    canvas.dataset.decodeCount = String(decodes.size);
    canvas.dataset.motion = paused ? "paused" : "live";
  };
  const clear = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = fillColor; ctx.fillRect(0, 0, width, height);
  };
  const nearFrames = () => [currentIndex, currentIndex + direction, currentIndex - direction].filter(index => index >= 0 && index < FRAME_COUNT);
  const fetchPriority = () => [...new Set([currentIndex, ...Array.from({ length: LOOKAHEAD }, (_, offset) => currentIndex + (offset + 1) * direction), currentIndex - direction])].filter(index => index >= 0 && index < FRAME_COUNT);
  const removeEncoded = (index: number) => { const entry = encoded.get(index); if (entry) { encodedBytes -= entry.blob.size; encoded.delete(index); } };
  const trimEncoded = () => {
    const protectedFrames = new Set([...nearFrames(), ...decodes.keys()]);
    while (encoded.size > ENCODED_LIMIT || encodedBytes > BYTE_LIMIT) {
      const entries = [...encoded.values()].sort((a, b) => a.touched - b.touched);
      const oldest = entries.find(entry => !protectedFrames.has(entry.index)) ?? entries[0];
      if (!oldest) break;
      removeEncoded(oldest.index);
    }
  };
  const trimCache = () => {
    const protectedFrames = new Set([...nearFrames(), lastPainted]);
    while (cache.size > CACHE_LIMIT) {
      const entries = [...cache.values()].sort((a, b) => a.touched - b.touched);
      const oldest = entries.find(entry => !protectedFrames.has(entry.index)) ?? entries[0];
      cache.delete(oldest.index); release(oldest.source);
    }
  };
  const clearRetry = () => { clearTimeout(retryTimer); retryTimer = retryDue = 0; };
  const resetAssets = () => {
    epoch++; clearRetry();
    for (const job of fetches.values()) { clearTimeout(job.timer); job.controller.abort(); } fetches.clear();
    // Native bitmap decoding cannot be interrupted. Retiring jobs keep their slots
    // until their promises settle, so a palette or size change cannot multiply work.
    for (const job of decodes.values()) job.controller.abort();
    for (const entry of cache.values()) release(entry.source); cache.clear();
    encoded.clear(); encodedBytes = 0; failures.clear();
    lastPainted = -1; paintedSignature = ""; canvas.dataset.painted = "false";
    resetBackground(); clear(); report("loading"); diagnostics(true);
  };
  const drawSource = (source: Source, zoom: number, alpha = 1) => {
    const imageWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const imageHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    const scaledHeight = height * zoom, scaledWidth = scaledHeight * imageWidth / imageHeight;
    ctx.globalAlpha = alpha;
    ctx.drawImage(source, (width - scaledWidth) / 2, (height - scaledHeight) / 2, scaledWidth, scaledHeight);
    ctx.globalAlpha = 1;
  };
  const blocked = (index: number) => (failures.get(index)?.count ?? 0) >= MAX_FAILURES;
  const draw = () => {
    const exact = cache.get(currentIndex);
    const closest = exact ?? [...cache.values()].sort((a, b) => Math.abs(a.index - currentIndex) - Math.abs(b.index - currentIndex) || Number(b.index === lastPainted) - Number(a.index === lastPainted))[0];
    if (!closest) { report(blocked(currentIndex) ? "fallback" : "loading"); return; }
    if (!exact && blocked(currentIndex)) { report("fallback"); return; }
    const intro = progress < 0.015 && cache.has(0) && cache.has(1);
    const blend = intro ? Math.round(idleFraction * 100) / 100 : 0;
    const zoom = displayZoom(progress);
    const signature = `${intro ? `intro:${blend}` : `frame:${closest.index}`}:zoom:${zoom.toFixed(4)}`;
    if (signature !== paintedSignature) {
      const first = intro ? cache.get(0)!.background : closest.background, second = intro ? cache.get(1)!.background : first;
      const mix = (channel: 0 | 1 | 2) => Math.round(first[channel] * (1 - blend) + second[channel] * blend);
      matchBackground([mix(0), mix(1), mix(2)]); clear();
      if (intro) { drawSource(cache.get(0)!.source, zoom); drawSource(cache.get(1)!.source, zoom, blend); cache.get(0)!.touched = cache.get(1)!.touched = performance.now(); }
      else { drawSource(closest.source, zoom); closest.touched = performance.now(); }
      lastPainted = intro ? blend < 0.5 ? 0 : 1 : closest.index;
      paintedSignature = signature; paintCount++; canvas.dataset.painted = "true";
    }
    report("ready");
    // A settled non-intro paint has no trailing animation loop to flush diagnostics.
    diagnostics(!intro || paused);
  };
  const tick = (timestamp: number) => {
    frame = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (timestamp - lastTime) / 1000 || 0.016)); lastTime = timestamp;
    if (!paused && progress < 0.015) { clock += dt; idleFraction = (1 - Math.cos(clock * 0.9)) / 2; }
    pump(); draw();
    if (!paused && progress < 0.015 && !blocked(currentIndex) && cache.has(0) && cache.has(1)) frame = requestAnimationFrame(tick);
  };
  const wake = () => { if (canRun() && !frame) { lastTime = 0; frame = requestAnimationFrame(tick); } };
  const scheduleRetry = (at: number) => {
    if (!canRun() || retryTimer && retryDue <= at) return;
    clearRetry(); retryDue = at;
    retryTimer = window.setTimeout(() => { retryTimer = retryDue = 0; wake(); }, Math.max(0, at - performance.now()));
  };
  const recordFailure = (index: number) => {
    const count = (failures.get(index)?.count ?? 0) + 1;
    const retryAt = performance.now() + (count >= MAX_FAILURES ? RETRY_COOLDOWN : RETRY_DELAY);
    failures.set(index, { count, retryAt });
    if (count < MAX_FAILURES && fetchPriority().includes(index)) scheduleRetry(retryAt);
    if (index === currentIndex && count >= MAX_FAILURES) report("fallback");
  };
  const startFetch = (index: number) => {
    const controller = new AbortController();
    const job: FetchJob = { controller, epoch, timer: 0, timedOut: false };
    job.timer = window.setTimeout(() => { job.timedOut = true; controller.abort(); }, FETCH_TIMEOUT);
    fetches.set(index, job);
    const filename = String(index).padStart(3, "0"), palette = theme, pixels = resolution;
    void fetchBlob(`/images/ivory-cake/${palette}/${pixels}/${filename}.webp`, controller.signal).then(blob => {
      if (disposed || job.epoch !== epoch || controller.signal.aborted) return;
      removeEncoded(index);
      encoded.set(index, { blob, index, touched: performance.now() }); encodedBytes += blob.size; trimEncoded();
    }).catch(() => {
      if (!disposed && job.epoch === epoch && (!controller.signal.aborted || job.timedOut)) recordFailure(index);
    }).finally(() => {
      clearTimeout(job.timer);
      if (fetches.get(index) === job) fetches.delete(index);
      if (disposed || job.epoch !== epoch) return;
      pump(); diagnostics(true); wake();
    });
  };
  const startDecode = (entry: EncodedEntry) => {
    const { index } = entry, controller = new AbortController(), job = { controller, epoch };
    decodes.set(index, job); entry.touched = performance.now();
    void decodeFrame(entry.blob, controller.signal).then(source => {
      if (disposed || job.epoch !== epoch || controller.signal.aborted || Math.abs(index - currentIndex) > MAX_DECODE_DISTANCE) { release(source); return; }
      failures.delete(index);
      cache.set(index, { source, background: sampleBackground(source), index, touched: performance.now() }); trimCache();
    }).catch(() => {
      if (disposed || job.epoch !== epoch || controller.signal.aborted) return;
      removeEncoded(index); recordFailure(index);
    }).finally(() => {
      if (decodes.get(index) === job) decodes.delete(index);
      if (disposed) return;
      pump(); diagnostics(true); wake();
    });
  };
  function pump() {
    if (!canRun()) return;
    // Finish active downloads instead of cancelling them on every scroll step. Their
    // compressed bytes also support reverse scrolling; refill slots from the latest target.
    for (const index of fetchPriority()) {
      if (fetches.size >= FETCH_LIMIT) break;
      if (encoded.has(index) || cache.has(index) || fetches.has(index) || decodes.get(index)?.epoch === epoch || blocked(index)) continue;
      const failure = failures.get(index);
      if (failure && performance.now() < failure.retryAt) { scheduleRetry(failure.retryAt); continue; }
      startFetch(index);
    }
    const nearby = [...encoded.values()].filter(entry => Math.abs(entry.index - currentIndex) <= MAX_DECODE_DISTANCE).sort((a, b) => Math.abs(a.index - currentIndex) - Math.abs(b.index - currentIndex));
    const candidates = [...new Set([...nearFrames(), ...(!cache.has(currentIndex) ? nearby.slice(0, 2).map(entry => entry.index) : [])])];
    for (const index of candidates) {
      if (decodes.size >= DECODE_LIMIT) break;
      const entry = encoded.get(index);
      if (entry && !cache.has(index) && !decodes.has(index) && !blocked(index)) startDecode(entry);
    }
  }
  const recoverFailures = () => {
    const now = performance.now();
    for (const index of fetchPriority()) { const failure = failures.get(index); if (failure && failure.count >= MAX_FAILURES && now >= failure.retryAt) failures.delete(index); }
  };
  const resize = () => {
    if (disposed) return;
    width = Math.max(1, canvas.clientWidth); height = Math.max(1, canvas.clientHeight);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const effectiveFrameWidth = height * 16 / 9 * dpr;
    const nextResolution = window.matchMedia("(max-width: 700px)").matches ? 1280 : effectiveFrameWidth > 2560 ? 3840 : 2560;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    if (nextResolution !== resolution) { resolution = nextResolution; resetAssets(); }
    else { paintedSignature = ""; clear(); }
    diagnostics(true); wake();
  };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake(); else { cancelAnimationFrame(frame); frame = 0; clearRetry(); }
  }); visibilityObserver.observe(canvas);
  listen(document, "visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; clearRetry(); }
    else wake();
  });
  options.onState("loading", theme); resize(); diagnostics(true);
  return {
    setProgress(value) {
      const next = clamp(value), nextIndex = Math.round(next * (FRAME_COUNT - 1));
      if (nextIndex !== currentIndex) { direction = nextIndex > currentIndex ? 1 : -1; clearRetry(); }
      currentIndex = nextIndex; progress = next;
      recoverFailures(); wake();
    },
    setTheme(value) { if (value === theme) return; theme = value; resetAssets(); wake(); },
    setPaused(value) { paused = value; if (paused) { cancelAnimationFrame(frame); frame = 0; } diagnostics(true); wake(); },
    dispose() {
      if (disposed) return;
      disposed = true; epoch++; cancelAnimationFrame(frame); clearRetry();
      resizeObserver.disconnect(); visibilityObserver.disconnect();
      for (const { target, type, fn } of listeners) target.removeEventListener(type, fn);
      for (const job of fetches.values()) { clearTimeout(job.timer); job.controller.abort(); } fetches.clear();
      for (const job of decodes.values()) job.controller.abort(); decodes.clear();
      for (const entry of cache.values()) release(entry.source); cache.clear();
      encoded.clear(); encodedBytes = 0; failures.clear(); resetBackground();
      sampleCanvas.width = sampleCanvas.height = 1; canvas.width = canvas.height = 1;
    },
  };
}

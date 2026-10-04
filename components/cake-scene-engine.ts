import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type CakeTheme = "dark" | "light";
export type TextureQuality = "auto" | "2k" | "4k";
export type CakeEngine = {
  setProgress(value: number): void;
  setTheme(value: CakeTheme): void;
  setReducedMotion(value: boolean): void;
  setMotionPaused(value: boolean): void;
  dispose(): void;
};
type Options = {
  progress: number; theme: CakeTheme; quality: TextureQuality; reducedMotion: boolean;
  onState(state: "loading" | "ready" | "error"): void;
};
type AssetDocument = { buffers?: { uri?: string }[]; images?: { uri?: string; mimeType?: string }[] };
const clamp = (value: number) => Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 1;
const mix = THREE.MathUtils.lerp;
const ease = (value: number) => value * value * (3 - 2 * value);

function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const texture of textures) {
    texture.dispose();
    const image = texture.source.data;
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

/** Fetching the complete, bounded assets also works when a host ignores HTTP ranges. */
async function readAsset(url: string, signal: AbortSignal, limit: number) {
  const response = await fetch(url, { signal, credentials: "same-origin" });
  if (!response.ok || !response.body) throw new Error("Cake asset unavailable");
  const declared = Number(response.headers.get("content-length"));
  if (declared > limit) { await response.body.cancel(); throw new Error("Cake asset too large"); }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) throw new Error("Cake asset too large");
      chunks.push(result.value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return data;
}

async function loadCake(quality: "2k" | "4k", signal: AbortSignal) {
  const modelURL = new URL(`/models/cake/cake-v3-${quality}.gltf`, window.location.origin);
  const json = new TextDecoder().decode(await readAsset(modelURL.href, signal, 512 * 1024));
  const document = JSON.parse(json) as AssetDocument;
  const objectURLs: string[] = [];
  const manager = new THREE.LoadingManager();
  try {
    const files = [
      ...(document.buffers ?? []).map((file) => ({ file, type: "application/octet-stream" })),
      ...(document.images ?? []).map((file) => ({ file, type: "image/webp" })),
    ];
    await Promise.all(files.map(async ({ file, type }) => {
      if (!file.uri) return;
      const url = new URL(file.uri, modelURL);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/models/cake/")) throw new Error("Invalid cake resource");
      const data = await readAsset(url.href, signal, 8 * 1024 * 1024);
      signal.throwIfAborted();
      const blobURL = URL.createObjectURL(new Blob([data.buffer], { type }));
      objectURLs.push(blobURL); file.uri = blobURL;
    }));
    signal.throwIfAborted();
    // All network requests are finished. Let these local Blob decodes complete so
    // an unmounted renderer can dispose every decoded bitmap instead of orphaning it.
    const gltf = await new GLTFLoader(manager).parseAsync(JSON.stringify(document), modelURL.href);
    let textured = false;
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      textured ||= materials.every((material) => material instanceof THREE.MeshStandardMaterial && material.map && material.normalMap && material.roughnessMap && material.metalnessMap && material.aoMap);
    });
    if (!textured) { disposeModel(gltf.scene); throw new Error("Cake textures could not be decoded"); }
    return gltf.scene;
  } finally { for (const url of objectURLs) URL.revokeObjectURL(url); }
}

export function createCakeEngine(canvas: HTMLCanvasElement, options: Options): CakeEngine {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  const cake = new THREE.Group(); scene.add(cake);
  const ambient = new THREE.HemisphereLight(0xfff7e9, 0x54453a, 0.35); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff4e6, 2.4);
  key.position.set(-3.6, 5.8, 4.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.0001; key.shadow.camera.left = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.camera.near = 0.1; key.shadow.camera.far = 16;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8edf7, 0.8); fill.position.set(4, 2, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffdeaa, 1.35); rim.position.set(1.5, 4, -4); scene.add(rim);
  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.12 });
  const groundGeometry = new THREE.CircleGeometry(3.5, 80);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.63; ground.receiveShadow = true; scene.add(ground);
  const mobile = window.matchMedia("(max-width: 700px)").matches;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const quality = options.quality === "auto" ? mobile || (memory !== undefined && memory <= 4) ? "2k" : "4k" : options.quality;
  canvas.dataset.textureQuality = quality;
  canvas.dataset.motion = options.reducedMotion ? "still" : "live";
  const abort = new AbortController();
  let disposed = false, failed = false, contextLost = false, loaded = false, visible = true, ready = false;
  let frame = 0, lastTime = 0, clock = 0, renders = 0, idleYaw = 0;
  let desiredProgress = clamp(options.progress), smoothProgress = desiredProgress, reduced = options.reducedMotion;
  let theme = options.theme, motionPaused = false, dragYaw = 0, targetYaw = 0, pointerX = 0, pointerY = 0, tiltX = 0, tiltY = 0;
  let dragPointer: number | null = null, downX = 0, downY = 0, lastX = 0, horizontalDrag = false;
  let environment: THREE.WebGLRenderTarget | null = null, model: THREE.Object3D | null = null;
  const size = new THREE.Vector3(3.2, 1.04, 3.15), target = new THREE.Vector3();
  let scannedPoints = new Float32Array(0);
  const listeners: { target: EventTarget; type: string; fn: EventListener }[] = [];
  const listen = (target: EventTarget, type: string, fn: EventListener) => { target.addEventListener(type, fn); listeners.push({ target, type, fn }); };

  const studio = () => {
    scene.environment = null; environment?.dispose(); environment = null;
    const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(renderer);
    try { environment = generator.fromScene(room, 0.04); scene.environment = environment.texture; }
    finally { room.dispose(); generator.dispose(); }
    scene.environmentIntensity = 0.75;
  };
  const themeLighting = () => {
    renderer.toneMappingExposure = theme === "light" ? 0.9 : 1;
    groundMaterial.opacity = theme === "light" ? 0.075 : 0.14;
    ambient.intensity = theme === "light" ? 0.45 : 0.35;
  };
  const pose = () => {
    const p = reduced ? 1 : smoothProgress;
    const orbit = ease(clamp(p / 0.68)), top = ease(clamp((p - 0.68) / 0.32));
    const elevation = mix(mix(0.35, 0.46, orbit), 0.94, top);
    cake.rotation.set(reduced ? 0 : tiltY * 0.065, -0.28 + orbit * 2.75 + top * 0.45 + idleYaw + dragYaw, reduced ? 0 : -tiltX * 0.025);
    cake.position.y = reduced ? 0 : Math.sin(clock * 0.85) * 0.026;
    const aspect = Math.max(camera.aspect, 0.15), tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const narrow = canvas.clientWidth <= 700;
    const desktopWidth = Math.max(650, Math.min(1300, canvas.clientWidth * 0.45));
    const widthFill = narrow ? 0.87 : Math.min(0.72, desktopWidth / canvas.clientWidth), heightFill = narrow ? 0.81 : 0.83;
    const macro = p < 0.47 ? ease(clamp((p - 0.28) / 0.19)) : 1 - ease(clamp((p - 0.47) / 0.43));
    target.set(0, macro * 0.1, 0);
    cake.updateMatrix();
    const matrix = cake.matrix.elements, sine = Math.sin(elevation), cosine = Math.cos(elevation);
    const horizontal = tan * aspect * widthFill, vertical = tan * heightFill;
    let fit = 0.1;
    // Solve the perspective inequalities for the actual scanned vertices. The
    // nearest surfaces matter: an orthographic bounding-height estimate clips them.
    for (let i = 0; i < scannedPoints.length; i += 3) {
      const x = scannedPoints[i], y = scannedPoints[i + 1], z = scannedPoints[i + 2];
      const worldX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
      const worldY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] - target.y;
      const worldZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
      const nearDepth = worldY * sine + worldZ * cosine, up = worldY * cosine - worldZ * sine;
      fit = Math.max(fit, nearDepth + Math.abs(worldX) / horizontal, nearDepth + Math.abs(up) / vertical);
    }
    // Intro and closing reveal are complete. The middle chapter deliberately
    // approaches the real chocolate and strawberry textures by up to 1.5x.
    const distance = (fit + 0.04) / (1 + macro * 0.5);
    camera.position.set(0, target.y + sine * distance, cosine * distance);
    camera.lookAt(target);
  };
  const draw = () => {
    if (disposed || contextLost || failed || !loaded) return;
    pose(); renderer.render(scene, camera);
    if (!ready) { ready = true; options.onState("ready"); }
    if (++renders === 1 || renders % 30 === 0) {
      canvas.dataset.frameCount = String(renders);
      canvas.dataset.motion = reduced ? "still" : motionPaused ? "paused" : "live";
      canvas.dataset.sceneProgress = (reduced ? 1 : smoothProgress).toFixed(3);
    }
  };
  const tick = (timestamp: number) => {
    frame = 0;
    if (disposed || failed || contextLost || !visible || document.hidden || !loaded) return;
    const dt = Math.min(0.05, Math.max(0.001, (timestamp - lastTime) / 1000 || 0.016)); lastTime = timestamp;
    const damping = 1 - Math.exp(-7 * dt);
    smoothProgress += (desiredProgress - smoothProgress) * damping;
    dragYaw += (targetYaw - dragYaw) * damping;
    tiltX += (pointerX - tiltX) * damping; tiltY += (pointerY - tiltY) * damping;
    if (!reduced && !motionPaused) { clock += dt; if (dragPointer === null) idleYaw += dt * 0.065; }
    try { draw(); } catch { failed = true; ready = false; options.onState("error"); return; }
    const unsettled = Math.abs(targetYaw - dragYaw) > 0.001 || (!reduced && (Math.abs(desiredProgress - smoothProgress) > 0.0004 || Math.abs(pointerX - tiltX) > 0.001 || Math.abs(pointerY - tiltY) > 0.001));
    if ((!reduced && !motionPaused) || unsettled) frame = requestAnimationFrame(tick);
  };
  const wake = () => { if (!frame && !disposed && !failed && !contextLost && visible && !document.hidden && loaded) { lastTime = 0; frame = requestAnimationFrame(tick); } };
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); wake();
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake(); else { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "100px" }); visibilityObserver.observe(canvas);
  listen(document, "visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake(); });
  listen(canvas, "webglcontextlost", (event) => {
    event.preventDefault(); contextLost = true; ready = false;
    cancelAnimationFrame(frame); frame = 0; options.onState("loading");
  });
  listen(canvas, "webglcontextrestored", () => {
    if (disposed || failed) return;
    try { studio(); themeLighting(); contextLost = false; resize(); wake(); }
    catch { failed = true; options.onState("error"); }
  });
  listen(canvas, "pointerdown", ((event: PointerEvent) => {
    if (!loaded || event.button !== 0) return;
    dragPointer = event.pointerId; downX = lastX = event.clientX; downY = event.clientY;
    horizontalDrag = event.pointerType !== "touch";
    canvas.setPointerCapture(event.pointerId); canvas.dataset.dragging = "true";
  }) as EventListener);
  listen(canvas, "pointermove", ((event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (dragPointer === event.pointerId) {
      if (!horizontalDrag && Math.abs(event.clientX - downX) > 8 && Math.abs(event.clientX - downX) > Math.abs(event.clientY - downY) * 1.2) horizontalDrag = true;
      if (horizontalDrag) targetYaw += (event.clientX - lastX) * 0.007;
      lastX = event.clientX;
    } else if (event.pointerType === "mouse" && !reduced) {
      pointerX = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
      pointerY = THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
    }
    wake();
  }) as EventListener);
  const endDrag = () => { dragPointer = null; canvas.dataset.dragging = "false"; wake(); };
  listen(canvas, "pointerup", endDrag); listen(canvas, "pointercancel", endDrag); listen(canvas, "lostpointercapture", endDrag);
  listen(canvas, "pointerleave", () => { pointerX = pointerY = 0; wake(); });
  listen(canvas, "keydown", ((event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); targetYaw += event.key === "ArrowLeft" ? -0.4 : 0.4; wake(); }
  }) as EventListener);
  // Synchronous rendering lets browser QA capture our own licensed-model poster.
  listen(canvas, "cake-scene-snapshot", () => { if (loaded && !contextLost && !disposed) { pose(); renderer.render(scene, camera); } });

  options.onState("loading");
  try { studio(); themeLighting(); resize(); }
  catch { failed = true; options.onState("error"); }
  if (!failed) void loadCake(quality, abort.signal).then((object) => {
    if (disposed) { disposeModel(object); return; }
    model = object;
    const box = new THREE.Box3().setFromObject(object), originalSize = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const scale = 3.2 / Math.max(originalSize.x, originalSize.z);
    object.scale.setScalar(scale); object.position.copy(center).multiplyScalar(-scale);
    size.copy(originalSize).multiplyScalar(scale);
    object.updateMatrixWorld(true);
    const points: number[] = [], vertex = new THREE.Vector3();
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true; node.receiveShadow = true;
      const positions = node.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
        points.push(vertex.x, vertex.y, vertex.z);
      }
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), mobile ? 4 : 8);
        if (material instanceof THREE.MeshStandardMaterial && material.map) {
          const image = material.map.source.data as { width?: number };
          if (image.width) canvas.dataset.textureResolution = String(image.width);
        }
      }
    });
    scannedPoints = new Float32Array(points);
    ground.position.y = -size.y / 2 - 0.055;
    cake.add(object); loaded = true; wake();
  }).catch(() => { if (!disposed) { abort.abort(); failed = true; options.onState("error"); } });

  return {
    setProgress(value) { desiredProgress = clamp(value); wake(); },
    setTheme(value) { theme = value; if (!disposed && !contextLost) themeLighting(); wake(); },
    setReducedMotion(value) { reduced = value; pointerX = pointerY = 0; if (reduced) { cancelAnimationFrame(frame); frame = 0; } wake(); },
    setMotionPaused(value) { motionPaused = value; canvas.dataset.motion = reduced ? "still" : value ? "paused" : "live"; wake(); },
    dispose() {
      if (disposed) return;
      disposed = true; abort.abort(); cancelAnimationFrame(frame);
      observer.disconnect(); visibilityObserver.disconnect();
      for (const { target, type, fn } of listeners) target.removeEventListener(type, fn);
      if (model) disposeModel(model);
      environment?.dispose(); scene.environment = null;
      groundGeometry.dispose(); groundMaterial.dispose(); key.shadow.map?.dispose();
      renderer.renderLists.dispose(); renderer.dispose();
    },
  };
}

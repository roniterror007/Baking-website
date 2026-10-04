"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CakeSequenceEngine, CakeTheme, SequenceState } from "./cake-sequence-engine";
import "./cake-scene.css";

type CakeSceneProps = { progress: number; className?: string; theme?: CakeTheme };
type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };
const connection = () => (navigator as Navigator & { connection?: Connection }).connection;
function posterPolicy() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || connection()?.saveData === true
    || ["slow-2g", "2g"].includes(connection()?.effectiveType ?? "");
}
function subscribePolicy(update: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)"), network = connection();
  media.addEventListener("change", update); network?.addEventListener("change", update);
  return () => { media.removeEventListener("change", update); network?.removeEventListener("change", update); };
}

/** Native rendered frames of the ivory cake, controlled by the story's scroll position. */
export function CakeScene({ progress, className = "", theme = "dark" }: CakeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null), engineRef = useRef<CakeSequenceEngine | null>(null);
  const progressRef = useRef(progress), themeRef = useRef(theme), pausedRef = useRef(false);
  const posterOnly = useSyncExternalStore(subscribePolicy, posterPolicy, () => true);
  const [state, setState] = useState<{ theme: CakeTheme; status: SequenceState }>({ theme, status: "loading" });
  const [missingPoster, setMissingPoster] = useState<CakeTheme | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => { progressRef.current = progress; engineRef.current?.setProgress(progress); }, [progress]);
  useEffect(() => { themeRef.current = theme; engineRef.current?.setTheme(theme); }, [theme]);
  useEffect(() => { pausedRef.current = paused; engineRef.current?.setPaused(paused); }, [paused]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || posterOnly) return;
    let disposed = false;
    void import("./cake-sequence-engine").then(({ createCakeSequenceEngine }) => {
      if (disposed) return;
      engineRef.current = createCakeSequenceEngine(canvas, {
        progress: progressRef.current, theme: themeRef.current, paused: pausedRef.current,
        onState: (status, palette) => { if (!disposed) setState(previous => previous.theme === palette && previous.status === status ? previous : { theme: palette, status }); },
      });
    }).catch(() => { if (!disposed) setState({ theme: themeRef.current, status: "fallback" }); });
    return () => { disposed = true; engineRef.current?.dispose(); engineRef.current = null; };
  }, [posterOnly]);
  const ready = !posterOnly && state.theme === theme && state.status === "ready";
  const posterMissing = missingPoster === theme;
  return <div className={`cake-scene cake-sequence-scene ${ready ? "is-ready" : ""} ${className}`} data-engine="rendered-3d-sequence" data-scene-state={posterOnly ? "poster" : ready ? "ready" : state.theme === theme ? state.status : "loading"} data-scene-theme={theme} style={{ backgroundColor: theme === "dark" ? "#18110e" : "#f7f2e9" }}>
    {!posterOnly && <canvas ref={canvasRef} className="cake-sequence-canvas" data-engine="rendered-3d-sequence" data-painted="false" role="img" aria-label="An ivory and gold cake with decorations floating into place as you scroll." aria-hidden={!ready} />}
    {!posterMissing && <>{/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={theme} className="cake-sequence-poster" src={`/images/ivory-cake/${theme}/poster.webp`} alt="An ivory two-tier cake with gold accents, flowers and delicate decorations." aria-hidden={ready} fetchPriority="high" decoding="async" onError={() => setMissingPoster(theme)} />
    </>}
    {!ready && posterMissing && <div className="cake-sequence-status" role="status" aria-live="polite"><span>Golden Delights</span><small>A little delight, in every detail.</small></div>}
    {ready && <button className="cake-sequence-pause" type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Resume cake motion" : "Pause cake motion"}>{paused ? "Resume motion" : "Pause motion"}</button>}
  </div>;
}

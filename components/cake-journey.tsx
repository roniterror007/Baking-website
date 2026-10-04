"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { CakeScene } from "./cake-scene";
import { useCommerce } from "./commerce";
import "./cake-journey.css";

type CakeJourneyProps = { theme: "light" | "dark" };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const fade = (value: number, from: number, to: number) => {
  const amount = clamp((value - from) / (to - from));
  return amount * amount * (3 - 2 * amount);
};
const CHAPTERS = [
  { label: "The signature", progress: 0 },
  { label: "Golden details", progress: 0.47 },
  { label: "Your moment", progress: 0.92 },
] as const;

function reducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeReducedMotion(update: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
}

/** One product, one continuous camera journey. Small screens retain the same motion. */
export function CakeJourney({ theme }: CakeJourneyProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
  const { openCustom } = useCommerce();

  useEffect(() => {
    if (reducedMotion) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const section = sectionRef.current;
      const screen = screenRef.current;
      if (!section || !screen) return;
      const bounds = section.getBoundingClientRect();
      const pinnedTop = Number.parseFloat(getComputedStyle(screen).top) || 0;
      const travel = Math.max(1, bounds.height - screen.getBoundingClientRect().height);
      const next = clamp((pinnedTop - bounds.top) / travel);
      setProgress(previous => Math.abs(previous - next) < 0.0005 ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    if (sectionRef.current) observer.observe(sectionRef.current);
    if (screenRef.current) observer.observe(screenRef.current);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [reducedMotion]);

  const sceneProgress = reducedMotion ? 0 : progress;
  const stage = sceneProgress < 0.28 ? 0 : sceneProgress < 0.68 ? 1 : 2;
  const introExit = fade(sceneProgress, 0.18, 0.28);
  const introOpacity = 1 - introExit;
  const detailOpacity = fade(sceneProgress, 0.28, 0.35) * (1 - fade(sceneProgress, 0.59, 0.68));
  const finalOpacity = fade(sceneProgress, 0.68, 0.8);
  const actionsOpacity = reducedMotion ? 1 : finalOpacity;
  const actionsEnabled = reducedMotion || actionsOpacity > 0.6;

  const jumpTo = (destination: number) => {
    const section = sectionRef.current;
    const screen = screenRef.current;
    if (!section || !screen) return;
    const bounds = section.getBoundingClientRect();
    const pinnedTop = Number.parseFloat(getComputedStyle(screen).top) || 0;
    const travel = Math.max(0, bounds.height - screen.getBoundingClientRect().height);
    window.scrollTo({
      top: Math.max(0, window.scrollY + bounds.top - pinnedTop + travel * destination),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  const continueJourney = () => {
    if (stage < 2) { jumpTo(CHAPTERS[stage + 1].progress); return; }
    document.getElementById("menu")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  };

  return <section
    ref={sectionRef}
    className={`gd-cinema ${reducedMotion ? "gd-cinema-reduced" : ""}`}
    data-mode={theme}
    data-stage={stage}
    aria-label="A closer look at Golden Delights"
  >
    <div ref={screenRef} className="gd-cinema-screen">
      <div className="gd-cinema-studio" aria-hidden="true" />
      <div className="gd-cinema-product">
        <CakeScene progress={sceneProgress} theme={theme} className="gd-cinema-model" />
      </div>

      <div
        className="gd-cinema-intro"
        style={{ opacity: introOpacity, transform: `translate3d(0, ${-24 * introExit}px, 0)` }}
        aria-hidden={stage !== 0}
      >
        <p className="gd-cinema-eyebrow">BANGALORE <span aria-hidden="true">/</span> BAKED TO ORDER</p>
        <h1>Pure delight.</h1>
        <p className="gd-cinema-subtitle">Made for your golden moments.</p>
      </div>

      <div
        className="gd-cinema-detail"
        style={{ opacity: detailOpacity, transform: `translate3d(0, ${12 * (1 - detailOpacity)}px, 0)` }}
        aria-hidden={stage !== 1}
      >
        <span className="gd-cinema-detail-index">02 / THE FINISHING TOUCHES</span>
        <h2>Beauty,<br />in the making.</h2>
      </div>

      <div
        className="gd-cinema-finale"
        style={{ opacity: finalOpacity, transform: `translate3d(0, ${16 * (1 - finalOpacity)}px, 0)` }}
        aria-hidden={stage !== 2}
      >
        <p className="gd-cinema-eyebrow">CRAFTED FOR YOU</p>
        <h2>Your moment.<span>Made beautiful.</span></h2>
      </div>

      <div
        className="gd-cinema-actions"
        style={{ opacity: actionsOpacity, transform: `translate3d(-50%, ${10 * (1 - actionsOpacity)}px, 0)` }}
        aria-hidden={!actionsEnabled}
        inert={!actionsEnabled}
      >
        <a className="gd-cinema-primary" href="#menu">Explore the collection <ArrowUpRight size={16} /></a>
        <button className="gd-cinema-secondary" onClick={openCustom}>Make it yours <ArrowUpRight size={16} /></button>
      </div>

      <p className="gd-cinema-explore" style={{ opacity: reducedMotion ? 0 : 1 - finalOpacity }} aria-hidden={reducedMotion || finalOpacity > 0.9}>
        <ArrowDown size={13} strokeWidth={1.3} aria-hidden="true" /> Scroll. Watch it come together.
      </p>

      {!reducedMotion && <div className="gd-cinema-bottom">
        <button className="gd-cinema-scroll" onClick={continueJourney} aria-label={stage < 2 ? "Scroll to the next cake view" : "Continue to the collection"}>
          <ArrowDown size={16} strokeWidth={1.4} /><span>SCROLL TO DISCOVER</span>
        </button>
        <nav className="gd-cinema-timeline" aria-label="Cake views">
          {CHAPTERS.map((chapter, index) => <button
            key={chapter.label}
            onClick={() => jumpTo(chapter.progress)}
            aria-current={stage === index ? "step" : undefined}
            className={stage === index ? "is-current" : ""}
          ><small>0{index + 1}</small><span>{chapter.label}</span></button>)}
          <span className="gd-cinema-track" aria-hidden="true"><i style={{ transform: `scaleX(${sceneProgress})` }} /></span>
        </nav>
        <span className="gd-cinema-note">A LITTLE LOVE. EVERY DETAIL.</span>
      </div>}
    </div>
  </section>;
}

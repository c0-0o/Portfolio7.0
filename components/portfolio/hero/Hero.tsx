"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "./hero.css";
import { DeepPartial, HeroConfig, mergeConfig } from "./hero-config";
import { HeroController, HeroPlayOptions } from "./hero-controller";

/** What the intro (or your own code) can call on the hero. */
export interface HeroHandle {
  show(): void;
  hide(): void;
  play(o?: HeroPlayOptions): void;
  tileBack(i: number): HTMLElement | null;
  readonly cols: number;
  readonly mobile: boolean;
}

export interface HeroProps {
  /** Partial override of hero-config.ts defaults. */
  config?: DeepPartial<HeroConfig>;
  /** Show + play the entrance on mount. Leave false when <PortfolioIntro/> hands off to the hero. */
  autoplay?: boolean;
}

const Hero = forwardRef<HeroHandle, HeroProps>(function Hero({ config, autoplay = false }, ref) {
  const root = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<HeroController | null>(null);
  const lines = !!config?.lines?.enabled;

  useImperativeHandle(
    ref,
    () => ({
      show: () => ctl.current?.show(),
      hide: () => ctl.current?.hide(),
      play: (o) => ctl.current?.play(o),
      tileBack: (i) => ctl.current?.tileBack(i) ?? null,
      get cols() {
        return ctl.current?.columns ?? 6;
      },
      get mobile() {
        return ctl.current?.isMobile ?? false;
      },
    }),
    []
  );

  useEffect(() => {
    if (!root.current || !grid.current) return;
    const c = new HeroController(root.current, grid.current, canvas.current, mergeConfig(config));
    ctl.current = c;
    if (autoplay) {
      c.show();
      c.play();
    }
    return () => {
      c.destroy();
      ctl.current = null;
    };
    // config is read once on mount (it is design-time configuration, not state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="portfolio-hero" ref={root} aria-label="Introduction">
      {lines && <canvas id="portfolio-hero-bg" ref={canvas} aria-hidden="true" />}
      <div className="h-grid" id="portfolio-hero-grid" ref={grid} aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <div className="h-txt h-des h-vt">
        <span className="h-rise"><span className="h-big">Designer</span></span>
      </div>
      <div className="h-txt h-ui">
        <div className="h-blk" />
        <div className="h-vt"><span className="h-rise"><span className="h-big">UI/UX</span></span></div>
      </div>
      <div className="h-txt h-hey">
        <span className="h-rise"><span className="h-lab"><i />Hey, I’m</span></span>
        <span className="h-rise"><span className="h-nm">Dipak <br />Pahari</span></span>
      </div>
      <p className="h-hint"><span>Scroll to Discover <b>↓</b></span></p>
      <h1 className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        Dipak Pahari, UI/UX Designer
      </h1>
    </section>
  );
});

export default Hero;

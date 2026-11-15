"use client";

import { useEffect, useRef } from "react";
import "./intro.css";
import type { HeroHandle } from "../hero/Hero";
import { IntroController } from "./intro-controller";
import AnimatedLogo from "@/components/AnimatedLogo/AnimatedLogo";
import { PORTFOLIO_OPENING_SCENE_EVENT } from "@/lib/magnetic-lines/PersistentMagneticBackground";
import { hasPortfolioClientNavigated } from "@/app/components/openingState";

/** Letters of PORTFOLIO, in reading order. w = design width at 1440px (scaled with --u). */
const LETTERS = {
  p: { src: "/opening/Vector-2.svg", w: 141, alt: "P" },
  row1: [
    { src: "/opening/Subtract.svg", w: 82, alt: "O" },
    { src: "/opening/Vector-1.svg", w: 68, alt: "R" },
    { src: "/opening/Vector.svg", w: 63, alt: "T" },
  ],
  row2: [
    { src: "/opening/Vector-5.svg", w: 39, alt: "F" },
    { src: "/opening/Vector-3.svg", w: 63, alt: "O" },
    { src: "/opening/Vector-7.svg", w: 38, alt: "L" },
    { src: "/opening/Vector-6.svg", w: 39, alt: "I" },
    { src: "/opening/Vector-4.svg", w: 63, alt: "O" },
  ],
};

export interface PortfolioIntroProps {
  /** Returns the hero so the loader can hand off to it. Usually `() => heroRef.current`. */
  getHero: () => HeroHandle | null;
  /** Play only once per browser session (default true). */
  once?: boolean;
  /** Minimum loader time in ms (default 8000). */
  minDuration?: number;
  /** Dev helper: show a "Replay intro" button (also: press R). Default false. */
  showReplay?: boolean;
  /** sessionStorage key used when `once` is enabled. */
  storageKey?: string;
}

/** Inline paths let the middle flower layer counter-rotate around the shared SVG center. */
function ICON() {
  return (
    <>
<path className="l1" d="M30.3369 0C32.9778 1.03539e-05 35.4483 1.30377 36.9395 3.4834L37.7598 4.68164C39.012 6.5123 41.0867 7.60728 43.3047 7.60742H43.6738C47.1809 7.60742 50.0244 10.4509 50.0244 13.958C50.0246 16.1133 51.1175 18.1213 52.9277 19.291L54.416 20.2529C56.6966 21.7266 58.0741 24.2564 58.0742 26.9717V27.7861C58.0742 30.6539 56.538 33.3024 54.0488 34.7266L53.1484 35.2422C51.2162 36.3479 50.0244 38.4037 50.0244 40.6299C50.0243 44.058 47.2445 46.8369 43.8164 46.8369H43.5088C41.1884 46.837 39.0433 48.0712 37.877 50.0771L36.71 52.083C35.2777 54.5463 32.6433 56.0625 29.7939 56.0625H28.9434C25.9839 56.0625 23.2661 54.4281 21.8779 51.8145L21.041 50.2402C19.9288 48.1463 17.7519 46.837 15.3809 46.8369H15.2363C11.7761 46.8369 8.9707 44.0315 8.9707 40.5713C8.97057 38.3735 7.81872 36.3363 5.93555 35.2031L3.875 33.9639C1.47031 32.5169 0 29.9149 0 27.1084V26.7275C0.000161947 23.7259 1.70664 20.9853 4.40039 19.6611L5.59277 19.0752C7.6604 18.0589 8.97062 15.9553 8.9707 13.6514C8.9707 10.3135 11.6768 7.60742 15.0146 7.60742H15.6533C17.8899 7.60734 19.978 6.48819 21.2168 4.62598L21.9199 3.56934C23.403 1.33995 25.9034 0 28.5811 0H30.3369ZM28.8652 7.71973C26.8015 7.71983 24.8744 8.75245 23.7314 10.4707L23.3359 11.0654C22.4399 12.4125 20.9294 13.2217 19.3115 13.2217H18.8496C16.4354 13.2218 14.4785 15.1796 14.4785 17.5938C14.4784 19.2601 13.5306 20.7815 12.0352 21.5166L11.1729 21.9404C9.2244 22.8983 7.99025 24.8806 7.99023 27.0518C7.99023 29.2526 9.14353 31.293 11.0293 32.4277L12.2832 33.1816C13.6453 34.0012 14.4784 35.4748 14.4785 37.0645C14.4785 39.5671 16.5071 41.5965 19.0098 41.5967H19.1143C20.8292 41.5967 22.4045 42.5431 23.209 44.0576L23.7051 44.9912C24.7765 47.008 26.8735 48.2685 29.1572 48.2686C31.4549 48.2686 33.5793 47.0468 34.7344 45.0605L35.3857 43.9404C36.2294 42.4894 37.7816 41.5967 39.46 41.5967H39.6826C42.162 41.5964 44.1719 39.5859 44.1719 37.1064C44.172 35.4964 45.0342 34.0096 46.4316 33.21L47.083 32.8369C48.8834 31.8069 49.9941 29.8916 49.9941 27.8174V27.5439C49.994 25.3831 48.898 23.3701 47.083 22.1973L46.2725 21.6729C44.9631 20.8268 44.172 19.3743 44.1719 17.8154C44.1719 15.2789 42.1156 13.2218 39.5791 13.2217H39.3125C37.7082 13.2217 36.2066 12.4306 35.3008 11.1064L34.8662 10.4707C33.6885 8.74938 31.737 7.71973 29.6514 7.71973H28.8652Z" fill="#74C716"/><path className="l2" d="M29.2773 13.5098C30.7493 13.5098 32.1269 14.2364 32.958 15.4512L33.2646 15.8994C33.9039 16.8339 34.9635 17.3936 36.0957 17.3936H36.2842C38.0742 17.3938 39.5254 18.8447 39.5254 20.6348C39.5254 21.735 40.0837 22.7603 41.0078 23.3574L41.5801 23.7275C42.8608 24.5553 43.6348 25.976 43.6348 27.501V27.6934C43.6348 29.1572 42.8506 30.5093 41.5801 31.2363L41.1201 31.499C40.1337 32.0634 39.5254 33.1135 39.5254 34.25C39.5252 35.9998 38.1063 37.418 36.3564 37.418H36.1992C35.0148 37.4181 33.9196 38.0483 33.3242 39.0723L32.8652 39.8623C32.0501 41.2643 30.5504 42.127 28.9287 42.127C27.3168 42.1269 25.8362 41.237 25.0801 39.8135L24.7305 39.1553C24.1627 38.0864 23.0511 37.418 21.8408 37.418H21.7676C20.0013 37.418 18.5693 35.986 18.5693 34.2197C18.5692 33.0979 17.9808 32.0579 17.0195 31.4795L16.1348 30.9473C14.8039 30.1464 13.9902 28.7065 13.9902 27.1533C13.9903 25.621 14.8612 24.2219 16.2363 23.5459L16.8447 23.2471C17.9001 22.7283 18.5692 21.6545 18.5693 20.4785C18.5693 18.7747 19.9505 17.3936 21.6543 17.3936H21.9805C23.1222 17.3935 24.188 16.8217 24.8203 15.8711L25.0996 15.4512C25.9063 14.2386 27.2663 13.5098 28.7227 13.5098H29.2773ZM28.7266 17.4502C27.673 17.4502 26.6889 17.9773 26.1055 18.8545L25.9033 19.1572C25.446 19.8448 24.6754 20.2588 23.8496 20.2588H23.6133C22.3811 20.259 21.3818 21.258 21.3818 22.4902C21.3817 23.3407 20.898 24.117 20.1348 24.4922L19.6953 24.709C18.7008 25.1978 18.0705 26.2092 18.0703 27.3174C18.0703 28.4406 18.6587 29.4823 19.6211 30.0615L20.2617 30.4473C20.9569 30.8656 21.3817 31.6174 21.3818 32.4287C21.3818 33.7062 22.4178 34.7421 23.6953 34.7422H23.749C24.6244 34.7422 25.4282 35.2259 25.8389 35.999L26.0918 36.4746C26.6386 37.5042 27.7092 38.1483 28.875 38.1484C30.0479 38.1484 31.1331 37.5247 31.7227 36.5107L32.0547 35.9385C32.4853 35.198 33.2772 34.7423 34.1338 34.7422H34.248C35.5136 34.742 36.5391 33.7158 36.5391 32.4502C36.5391 31.6283 36.9799 30.8691 37.6934 30.4609L38.0254 30.2715C38.9443 29.7457 39.5116 28.7677 39.5117 27.709V27.5693C39.5117 26.4662 38.9519 25.4385 38.0254 24.8398L37.6113 24.5723C36.943 24.1404 36.5391 23.3983 36.5391 22.6025C36.5389 21.308 35.4899 20.259 34.1953 20.2588H34.0586C33.2399 20.2587 32.4741 19.8543 32.0117 19.1787L31.79 18.8545C31.189 17.9758 30.1926 17.4503 29.1279 17.4502H28.7266Z" fill="#74C716" fillOpacity="0.7"/><path className="l3" d="M28.9141 20.5C29.6538 20.5 30.3459 20.8651 30.7637 21.4756L30.918 21.7012C31.2393 22.1709 31.7718 22.4521 32.3408 22.4521H32.4355C33.3353 22.4522 34.0645 23.1813 34.0645 24.0811C34.0645 24.634 34.3452 25.1491 34.8096 25.4492L35.0977 25.6348C35.7415 26.0508 36.1299 26.7657 36.1299 27.5322V27.6289C36.1299 28.3645 35.7361 29.0437 35.0977 29.4092L34.8662 29.542C34.3706 29.8257 34.0645 30.3528 34.0645 30.9238C34.0645 31.8034 33.3512 32.5166 32.4717 32.5166H32.3936C31.7983 32.5166 31.2475 32.8331 30.9482 33.3477L30.7168 33.7451C30.3071 34.4497 29.5534 34.8838 28.7383 34.8838C27.9283 34.8836 27.1847 34.436 26.8047 33.7207L26.6289 33.3896C26.3436 32.8525 25.785 32.5167 25.1768 32.5166H25.1396C24.2519 32.5166 23.5323 31.7969 23.5322 30.9092C23.5322 30.3453 23.2361 29.823 22.7529 29.5322L22.3086 29.2637C21.6397 28.8612 21.2305 28.1381 21.2305 27.3574C21.2305 26.5872 21.6682 25.8837 22.3594 25.5439L22.665 25.3936C23.1955 25.1328 23.5322 24.5931 23.5322 24.002C23.5324 23.1459 24.2259 22.4524 25.082 22.4521H25.2461C25.82 22.4521 26.356 22.1644 26.6738 21.6865L26.8145 21.4756C27.2198 20.8663 27.903 20.5002 28.6348 20.5H28.9141ZM28.6367 22.4805C28.1072 22.4805 27.6126 22.7456 27.3193 23.1865L27.2178 23.3389C26.9879 23.6843 26.6004 23.8915 26.1855 23.8916H26.0664C25.4471 23.8918 24.9453 24.3944 24.9453 25.0137C24.9452 25.4411 24.7019 25.8309 24.3184 26.0195L24.0967 26.1289C23.597 26.3747 23.2803 26.8835 23.2803 27.4404C23.2804 28.005 23.5768 28.5283 24.0605 28.8193L24.3818 29.0127C24.7312 29.2229 24.9452 29.601 24.9453 30.0088C24.9453 30.6508 25.4655 31.1717 26.1074 31.1719H26.1348C26.5747 31.1719 26.9792 31.4151 27.1855 31.8037L27.3125 32.043C27.5874 32.5602 28.1252 32.8837 28.7109 32.8838C29.3005 32.8838 29.8462 32.5702 30.1426 32.0605L30.3096 31.7734C30.526 31.4012 30.9239 31.1719 31.3545 31.1719H31.4111C32.0473 31.1719 32.5635 30.6557 32.5635 30.0195C32.5636 29.6065 32.785 29.2246 33.1436 29.0195L33.3105 28.9248C33.7724 28.6606 34.0576 28.1688 34.0576 27.6367V27.5664C34.0576 27.012 33.7762 26.4952 33.3105 26.1943L33.1025 26.0596C32.7666 25.8425 32.5635 25.4703 32.5635 25.0703C32.5635 24.4195 32.0356 23.8916 31.3848 23.8916H31.3164C30.9049 23.8915 30.5195 23.6883 30.2871 23.3486L30.1758 23.1865C29.8736 22.7448 29.373 22.4805 28.8379 22.4805H28.6367Z" fill="#74C716" fillOpacity="0.4"/>
    </>
  );
}

function Img({ src, w, alt }: { src: string; w: number; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img data-l src={src} width={w} style={{ width: `calc(${w}*var(--u))` }} alt={alt} />;
}

export default function PortfolioIntro({ getHero, once = true, minDuration = 8000, showReplay = false, storageKey = "portfolio-intro-seen" }: PortfolioIntroProps) {
  const replay = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const showOpeningLines = () => {
      window.dispatchEvent(new CustomEvent(PORTFOLIO_OPENING_SCENE_EVENT, { detail: true }));
    };
    const hideOpeningLines = () => {
      window.dispatchEvent(new CustomEvent(PORTFOLIO_OPENING_SCENE_EVENT, { detail: false }));
    };
    let c: IntroController | null = null;
    const timer = window.setTimeout(() => {
      c = new IntroController({
        getHero,
        onStart: showOpeningLines,
        once,
        skipOnClientNavigation: hasPortfolioClientNavigated(),
        minDuration,
        replayButton: replay.current,
        storageKey,
        onComplete: hideOpeningLines,
      });
      c.start();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      c?.destroy();
      hideOpeningLines();
    };
    // props are configuration read once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="portfolio-intro" data-portfolio-intro data-active="">
        <div id="gA" className="grid layer" aria-hidden="true" />
        <section id="open" className="layer" aria-hidden="true">
          <div className="stage">
            <div className="title" id="title">
              <Img {...LETTERS.p} />
              <div className="rows">
                <div className="row r1">{LETTERS.row1.map((l, i) => <Img key={i} {...l} />)}</div>
                <div className="row r2">{LETTERS.row2.map((l, i) => <Img key={i} {...l} />)}</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="star" id="star" src="/opening/star.svg" alt="" />
            </div>
            <div className="ld" id="ld">
              <div className="ico" id="ico">
                <svg viewBox="0 0 59 57" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <ICON />
                </svg>
              </div>
              <p>Loading<span className="dots" /></p>
            </div>
            <div className="hint" id="hint">Good things take time</div>
          </div>
        </section>
        <div className="opening-masthead" aria-hidden="true">
          <AnimatedLogo
            size={44}
            interactive
            idleAnimation
            priority
            ariaLabel="Dipak Pahari logo"
            className="opening-masthead-logo"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="opening-masthead-frame"
            src="/opening/openingframe.svg"
            width={135}
            height={21}
            alt=""
          />
        </div>
        {showReplay && <button id="replay" ref={replay} type="button" disabled>↻ Replay intro</button>}
      </div>
    </>
  );
}

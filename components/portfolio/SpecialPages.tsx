"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants,
} from "framer-motion";
import Button from "@/components/Button";
import { PortfolioActionButton } from "./PortfolioActionButton";

const EMAIL = "nexgen.d.pahari@gmail.com";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

const maskUp: Variants = {
  hidden: { y: "105%" },
  show: { y: 0, transition: { duration: 0.8, ease: EASE } },
};

function FitFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useEffect(() => {
    const wrapper = wrap.current;
    const content = stage.current;
    if (!wrapper || !content) return;

    const update = () => {
      const width = content.offsetWidth;
      if (!width) return;
      const scale = Math.min(1, wrapper.clientWidth / width);
      const height = content.offsetHeight * scale;
      setFit((current) =>
        current.scale === scale && current.height === height ? current : { scale, height },
      );
    };

    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    observer.observe(content);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} className={`w-full ${className}`} style={{ height: fit.height || undefined }}>
      <div ref={stage} className="w-fit origin-top-left" style={{ transform: `scale(${fit.scale})` }}>
        {children}
      </div>
    </div>
  );
}

function ParallaxLayer({
  sx,
  sy,
  depth,
  float,
  duration,
  className,
  children,
}: {
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  depth: number;
  float: number;
  duration: number;
  className: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const x = useTransform(sx, (value) => value * depth);
  const y = useTransform(sy, (value) => value * depth);

  return (
    <motion.div style={{ x, y }} className={`absolute ${className}`}>
      <motion.div
        animate={reduce ? undefined : { y: [0, -float, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function ConstructionIllustration() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 18 });
  const sy = useSpring(my, { stiffness: 120, damping: 18 });
  const reduce = useReducedMotion();

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mx.set((event.clientX - rect.left) / rect.width - 0.5);
    my.set((event.clientY - rect.top) / rect.height - 0.5);
  };
  const onPointerLeave = () => {
    mx.set(0);
    my.set(0);
  };
  const pop = (delay: number) => ({
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: "spring" as const, stiffness: 160, damping: 14, delay: reduce ? 0 : delay },
  });

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative h-[258px] w-[342px] lg:h-[530px] lg:w-[560px]"
    >
      <ParallaxLayer sx={sx} sy={sy} depth={-18} float={8} duration={6} className="left-0 top-0">
        <motion.div {...pop(0.2)} className="size-[97px] bg-[#ecefe6] lg:size-[180px]" />
      </ParallaxLayer>

      <ParallaxLayer
        sx={sx}
        sy={sy}
        depth={18}
        float={10}
        duration={7}
        className="left-[205px] top-[173px] lg:left-[380px] lg:top-[320px]"
      >
        <motion.div {...pop(0.35)} className="size-[97px] bg-[#e5e9de] lg:size-[180px]" />
      </ParallaxLayer>

      <ParallaxLayer
        sx={sx}
        sy={sy}
        depth={28}
        float={9}
        duration={5}
        className="left-[28px] top-[27px] lg:left-[51px] lg:top-[50px]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 4 }}
          transition={{ type: "spring", stiffness: 140, damping: 13, delay: reduce ? 0 : 0.5 }}
          className="flex h-[221px] w-[211px] flex-col items-center justify-center bg-lime lg:h-[410px] lg:w-[390px]"
        >
          <div className="-rotate-[4deg]">
            <motion.svg
              viewBox="0 0 120 80"
              aria-hidden="true"
              className="h-[119px] w-[84px] lg:h-[220px] lg:w-[156px]"
              whileHover={reduce ? undefined : { rotate: [0, -10, 10, -6, 0], scale: 1.1 }}
              transition={{ duration: 0.6 }}
            >
              <path
                d="M8 40C22 22 40 13 60 13s38 9 52 27c-14 18-32 27-52 27S22 58 8 40Z"
                fill="#141712"
              />
              <ellipse cx="60" cy="40" rx="18" ry="22" fill="#ADEB66" />
              <circle cx="60" cy="40" r="9" fill="#141712" />
              <circle cx="64" cy="36" r="3" fill="#FCFDF8" />
            </motion.svg>
          </div>
          <div className="font-display text-[74px] leading-[0.95] text-ink lg:text-[137px]">
            {"WIP".split("").map((character, index) => (
              <motion.span
                key={index}
                className="inline-block"
                whileHover={reduce ? undefined : { y: -8, rotate: -6 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                {character}
              </motion.span>
            ))}
          </div>
          <p className="mt-1 hidden text-xs font-bold text-ink lg:block">A FEW DETAILS TO UNTANGLE.</p>
        </motion.div>
      </ParallaxLayer>

      <p className="absolute left-[122px] top-[493px] hidden text-[13px] font-bold text-muted lg:block">
        STILL MAKING IT FEEL RIGHT.
      </p>
    </div>
  );
}

function ConstructionBadge() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      variants={rise}
      className="relative inline-flex h-7 w-fit items-center overflow-hidden bg-lime px-3 text-[11px] font-bold text-ink lg:h-8 lg:text-xs"
    >
      UNDER CONSTRUCTION
      {!reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent"
          initial={{ left: "-40%" }}
          animate={{ left: "140%" }}
          transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 }}
        />
      )}
    </motion.div>
  );
}

function RevealLine({ children }: { children: ReactNode }) {
  return (
    <span className="block overflow-hidden pb-1">
      <motion.span variants={maskUp} className="block">
        {children}
      </motion.span>
    </span>
  );
}

function ConstructionCopy() {
  return (
    <motion.div variants={stagger} className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2 lg:justify-center">
      <h1 className="font-display text-[clamp(30px,10.5vw,43px)] leading-[1.02] text-ink lg:text-[52px] xl:text-[68px] xl:leading-[69.4px]">
        <motion.span variants={stagger} className="block">
          <RevealLine>GOOD THINGS.</RevealLine>
          <RevealLine>IN THE MAKING.</RevealLine>
        </motion.span>
      </h1>

      <motion.p variants={rise} className="max-w-[338px] text-base leading-[1.55] text-muted lg:max-w-[475px] lg:text-lg">
        This corner of my portfolio is still taking shape. I’m working on the details that make it feel right.
      </motion.p>

      <motion.div variants={rise} className="mt-2 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
        <Button text="Get in touch" onClick={() => window.location.assign(`mailto:${EMAIL}`)} />
        <Link href="/" className="portfolio-text-link">
          Back to home <span aria-hidden="true">↗</span>
        </Link>
      </motion.div>

      <motion.div variants={rise} className="mt-4 flex flex-col gap-3">
        <a
          href={`mailto:${EMAIL}`}
          className="w-fit break-all text-sm text-ink underline underline-offset-4 transition-[text-underline-offset] hover:underline-offset-[7px] lg:text-base"
        >
          {EMAIL}
        </a>
        <p className="text-xs text-muted lg:text-sm">Thanks for stopping by. Come back soon.</p>
      </motion.div>
    </motion.div>
  );
}

export function UnderConstructionExperience() {
  return (
    <motion.section
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto grid min-h-[70svh] w-full max-w-[1440px] content-center gap-8 px-6 py-8 md:px-10 lg:min-h-[min(800px,calc(100svh-100px))] lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:py-14 lg:pl-12 xl:pl-[72px]"
    >
      <ConstructionBadge />
      <FitFrame className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-[560px] lg:justify-self-end">
        <ConstructionIllustration />
      </FitFrame>
      <ConstructionCopy />
    </motion.section>
  );
}

function Digit({ children, delay, className }: { children: string; delay: number; className: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.span
      initial={{ opacity: 0, y: reduce ? 0 : -120 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 11, delay: reduce ? 0 : delay }}
      className={`absolute ${className}`}
    >
      <motion.span
        className="block cursor-default"
        whileHover={reduce ? undefined : { y: -14, rotate: -4 }}
        whileTap={reduce ? undefined : { scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 12 }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

function NotFoundIllustration() {
  const reduce = useReducedMotion();
  const [spins, setSpins] = useState(0);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 18 });
  const sy = useSpring(my, { stiffness: 120, damping: 18 });
  const digitClass =
    "top-12 font-display text-[174px] leading-[177.5px] text-ink lg:top-[79px] lg:text-[318px] lg:leading-[324.4px]";

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mx.set((event.clientX - rect.left) / rect.width - 0.5);
    my.set((event.clientY - rect.top) / rect.height - 0.5);
  };
  const onPointerLeave = () => {
    mx.set(0);
    my.set(0);
  };
  const tile = (delay: number) => ({
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: "spring" as const, stiffness: 160, damping: 14, delay: reduce ? 0 : delay },
  });

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative h-60 w-[342px] lg:h-[456px] lg:w-[624px]"
    >
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.2 }}
        className="absolute left-0 top-0 text-[11px] font-bold text-muted lg:text-[13px]"
      >
        404 / PAGE NOT FOUND
      </motion.p>

      <ParallaxLayer sx={sx} sy={sy} depth={-18} float={8} duration={6} className="left-0 top-9 lg:top-[79px]">
        <motion.div {...tile(0.2)} className="size-[114px] bg-[#ecefe6] lg:size-[208px]" />
      </ParallaxLayer>
      <ParallaxLayer
        sx={sx}
        sy={sy}
        depth={18}
        float={10}
        duration={7}
        className="left-[228px] top-[104px] lg:left-[416px] lg:top-[156px]"
      >
        <motion.div {...tile(0.3)} className="size-[114px] bg-[#f0f2eb] lg:size-[208px]" />
      </ParallaxLayer>

      <Digit delay={0.4} className={`${digitClass} left-2 lg:left-2.5`}>4</Digit>

      <ParallaxLayer sx={sx} sy={sy} depth={30} float={9} duration={5} className="left-[102px] top-14 lg:left-[187px] lg:top-[95px]">
        <motion.div
          initial={{ opacity: 0, scale: 0, rotate: -90 }}
          animate={{ opacity: 1, scale: 1, rotate: 5 + 360 * spins }}
          transition={{ type: "spring", stiffness: 120, damping: 12, delay: spins || reduce ? 0 : 0.7 }}
          whileHover={reduce ? undefined : { scale: 1.06 }}
          onTap={() => setSpins((current) => current + 1)}
          className="flex h-[174px] w-[113px] cursor-pointer justify-center bg-lime lg:h-[304px] lg:w-[206px]"
        >
          <motion.div
            animate={reduce ? undefined : { x: [0, 10, -6, 0], rotate: [0, 4, -4, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-full items-center justify-center font-display text-[158px] leading-none text-ink lg:text-[286px]"
          >
            0
          </motion.div>
        </motion.div>
      </ParallaxLayer>

      <Digit delay={0.55} className={`${digitClass} left-[239px] lg:left-[436px]`}>4</Digit>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 1.1 }}
        className="absolute left-2 top-[420px] hidden text-base text-muted lg:block"
      >
        Wrong turn. Good company.
      </motion.p>
    </div>
  );
}

function NotFoundCopy() {
  return (
    <motion.div variants={stagger} className="flex flex-col gap-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.1em] text-muted">404 / PAGE NOT FOUND</p>
        <h1 className="mt-4 font-display text-[clamp(30px,10.5vw,43px)] leading-[1.02] text-ink lg:text-[52px] xl:text-[66px] xl:leading-[67.3px]">
          <motion.span variants={stagger} className="block">
            <RevealLine>THIS PAGE</RevealLine>
            <RevealLine>WANDERED OFF.</RevealLine>
          </motion.span>
        </h1>
      </div>

      <motion.p variants={rise} className="max-w-[460px] text-base leading-[1.6] text-muted lg:text-lg">
        The link may be broken, or the page may have moved. Let’s get you somewhere good.
      </motion.p>

      <motion.div variants={rise} className="mt-2 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
        <PortfolioActionButton to="/" label="Back to home" />
        <Link href="/#work" className="portfolio-text-link">
          Explore my work <span aria-hidden="true">↗</span>
        </Link>
      </motion.div>

      <motion.p variants={rise} className="mt-4 text-xs text-muted lg:text-sm">
        Still curious? There’s plenty to explore at home.
      </motion.p>
    </motion.div>
  );
}

export function NotFoundExperience() {
  return (
    <motion.section
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto grid min-h-[70svh] w-full max-w-[1440px] content-center gap-10 px-6 py-8 md:px-10 lg:min-h-[min(760px,calc(100svh-100px))] lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-x-12 lg:py-14 xl:gap-x-[110px] xl:px-[72px]"
    >
      <FitFrame className="lg:max-w-[624px]">
        <NotFoundIllustration />
      </FitFrame>
      <NotFoundCopy />
    </motion.section>
  );
}

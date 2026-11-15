"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { useRef } from "react";
import { PillButton, SectionLabel, Tag } from "./site";

const PORTRAIT = "/idneittycard2.jpeg";

const expertise = [
  {
    n: "01 /",
    title: "MAKE IT MAKE SENSE.",
    body: "Research, journeys, and flows that get to the heart of what people actually need.",
    tags: ["Discovery", "UX strategy"],
    icon: { src: "/Symbol1.svg", width: 30, height: 30 },
  },
  {
    n: "02 /",
    title: "MAKE IT FEEL RIGHT.",
    body: "Distinctive interfaces that balance clarity, accessibility, and a healthy dose of character.",
    tags: ["UI design", "Design systems"],
    icon: { src: "/Symbol2.svg", width: 42, height: 42 },
  },
  {
    n: "03 /",
    title: "MAKE IT WORK TOGETHER.",
    body: "Clickable prototypes and thoughtful handoffs that connect the idea to the experience.",
    tags: ["Prototyping", "Collaboration"],
    icon: { src: "/Symbol3.svg", width: 50, height: 40 },
  },
];

const words: Variants = {
  hidden: { opacity: 0.2, y: 12 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: index * 0.055 },
  }),
};
const stillWords: Variants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
};

function WordReveal({
  children,
  start = 0,
  reducedMotion = false,
}: {
  children: string;
  start?: number;
  reducedMotion?: boolean;
}) {
  const variants = reducedMotion ? stillWords : words;

  return (
    <>
      {children.split(" ").map((word, index, list) => (
        <span key={`${word}-${index}`}>
          <motion.span className="inline-block" variants={variants} custom={start + index}>
            {word}
          </motion.span>
          {index < list.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

export default function HomeAnimatedSections() {
  const expertiseRef = useRef<HTMLElement>(null);
  const designerRef = useRef<HTMLElement>(null);
  const expertiseInView = useInView(expertiseRef, { once: true, amount: 0.18 });
  const designerInView = useInView(designerRef, { once: true, amount: 0.2 });
  const reduce = useReducedMotion() ?? false;

  const section: Variants = {
    hidden: { opacity: reduce ? 1 : 0 },
    show: { opacity: 1, transition: { duration: reduce ? 0.01 : 0.45 } },
  };
  const heading: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.055, delayChildren: reduce ? 0 : 0.12 } },
  };
  const cardList: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.14, delayChildren: reduce ? 0 : 0.2 } },
  };
  const card: Variants = {
    hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 24 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0.01 : 0.55, ease: [0.22, 1, 0.36, 1] } },
  };
  const detail: Variants = {
    hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0.01 : 0.4, delay: reduce ? 0 : 0.28 } },
  };

  return (
    <>
      <motion.section
        ref={expertiseRef}
        className="gutter flex flex-col gap-8 bg-ink py-14 md:gap-11 md:py-22"
        variants={section}
        initial="hidden"
        animate={expertiseInView ? "show" : "hidden"}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-187.5 flex-col gap-4">
            <motion.div
              initial={{ opacity: 0, x: reduce ? 0 : -12 }}
              animate={expertiseInView ? { opacity: 1, x: 0 } : { opacity: 0, x: reduce ? 0 : -12 }}
              transition={{ duration: reduce ? 0.01 : 0.45 }}
            >
              <SectionLabel tone="lime">WHAT I BRING TO THE TABLE</SectionLabel>
            </motion.div>
            <motion.h2
              className="text-[clamp(36px,5vw,64px)] leading-[1.02] text-paper"
              variants={heading}
              initial="hidden"
              animate={expertiseInView ? "show" : "hidden"}
            >
              <WordReveal reducedMotion={reduce}>GOOD LOOKS. GREAT THINKING.</WordReveal>
            </motion.h2>
          </div>
          <motion.p
            className="max-w-75 text-[15px] leading-[1.6] text-soft"
            variants={detail}
            initial="hidden"
            animate={expertiseInView ? "show" : "hidden"}
          >
            From the first “what if” to the final tiny detail. Here’s where I can help.
          </motion.p>
        </div>
        <motion.div
          className="grid gap-4 md:grid-cols-3 md:gap-6"
          variants={cardList}
          initial="hidden"
          animate={expertiseInView ? "show" : "hidden"}
        >
          {expertise.map((item) => (
            <motion.article
              key={item.n}
              className="flex flex-col gap-6 rounded-xl border border-ink-line p-5 transition-colors hover:border-lime/50 sm:p-6 md:rounded-[20px] md:p-7"
              variants={card}
            >
              <div className="flex items-start justify-between text-xs text-lime">
                <span>{item.n}</span>
                <motion.span
                  initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.72, rotate: reduce ? 0 : -12 }}
                  animate={expertiseInView ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.72, rotate: reduce ? 0 : -12 }}
                  transition={{ duration: reduce ? 0.01 : 0.45, delay: reduce ? 0 : 0.16 }}
                >
                  <Image
                    src={item.icon.src}
                    alt=""
                    aria-hidden="true"
                    width={item.icon.width}
                    height={item.icon.height}
                    className="h-7 w-auto sm:h-8 md:h-8"
                  />
                </motion.span>
              </div>
              <h3 className="mt-6 text-[26px] leading-[1.05] text-paper">{item.title}</h3>
              <motion.p
                className="text-sm leading-[1.6] text-soft"
                variants={detail}
              >
                {item.body}
              </motion.p>
              <motion.div className="flex flex-wrap gap-2" variants={detail}>
                {item.tags.map((tag) => (
                  <Tag key={tag} dark>
                    {tag}
                  </Tag>
                ))}
              </motion.div>
            </motion.article>
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        ref={designerRef}
        className="gutter flex flex-col items-center gap-12 py-14 md:flex-row md:gap-20 md:py-22"
        variants={section}
        initial="hidden"
        animate={designerInView ? "show" : "hidden"}
      >
        <Link
          href="/about"
          aria-label="Learn more about Dipak"
          className="group block shrink-0 rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime"
        >
          <motion.div
            className="relative h-85 w-75 shrink-0 md:h-100 md:w-92"
            initial={{ opacity: reduce ? 1 : 0, x: reduce ? 0 : -36, rotate: reduce ? 0 : -3 }}
            animate={designerInView ? { opacity: 1, x: 0, rotate: 0 } : { opacity: reduce ? 1 : 0, x: reduce ? 0 : -36, rotate: reduce ? 0 : -3 }}
            transition={{ duration: reduce ? 0.01 : 0.7, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.12 }}
          >
            <div className="absolute top-14 left-6 h-73.5 w-69 rotate-[-4deg] rounded-xl bg-lime md:rounded-[20px]" />
            <div className="absolute top-12 left-3 h-73.5 w-69 rotate-[7deg] overflow-hidden rounded-xl md:rounded-[20px]">
              <Image
                src={PORTRAIT}
                alt=""
                fill
                sizes="(min-width: 768px) 276px, 276px"
                className="object-cover object-[66%_center] transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <motion.span
              className="font-display absolute right-0 bottom-6 -rotate-6 bg-ink px-3 py-1.5 text-sm text-lime"
              initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.82, y: reduce ? 0 : 12 }}
              animate={designerInView ? { opacity: 1, scale: 1, y: 0 } : { opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.82, y: reduce ? 0 : 12 }}
              transition={{ duration: reduce ? 0.01 : 0.45, delay: reduce ? 0 : 0.5 }}
            >
              ALWAYS CURIOUS
            </motion.span>
          </motion.div>
        </Link>
        <div className="flex flex-col items-start gap-6">
          <motion.h2
            className="text-[clamp(34px,4.5vw,56px)] leading-[1.02]"
            variants={heading}
            initial="hidden"
            animate={designerInView ? "show" : "hidden"}
          >
            <WordReveal reducedMotion={reduce}>A DESIGNER.</WordReveal>
            <br />
            <WordReveal start={2} reducedMotion={reduce}>A QUESTION ASKER.</WordReveal>
            <br />
            <WordReveal start={5} reducedMotion={reduce}>A WORK IN PROGRESS.</WordReveal>
          </motion.h2>
          <motion.p
            className="max-w-160 text-lg leading-[1.6] text-muted"
            variants={detail}
            initial="hidden"
            animate={designerInView ? "show" : "hidden"}
          >
            I’m Dipak. I design interfaces that feel clear and useful. Beyond the screen, I draw,
            doodle, and explore messy, imperfect ideas. Bringing different skills and perspectives
            together helps me turn curiosity into thoughtful design.
          </motion.p>
          <motion.div
            variants={detail}
            initial="hidden"
            animate={designerInView ? "show" : "hidden"}
          >
            <PillButton to="/about">More about me</PillButton>
          </motion.div>
        </div>
      </motion.section>
    </>
  );
}

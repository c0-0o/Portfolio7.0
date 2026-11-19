"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import logo from "./assets/cat-logo.svg";
import s from "./ContactFooter.module.css";

/* ───────────── content (edit here) ───────────── */
const EMAIL = "nexgen.d.pahari@gmail.com";
const EXPLORE = {
  home: { label: "Home", href: "/" },
  work: { label: "Work", href: "/work" },
  about: { label: "About", href: "/about" },
  playground: { label: "Playground", href: "/playground" },
  contact: { label: "Contact", href: "/contact" },
} as const;
const ELSEWHERE = [
  [
    { label: "Behance", href: "https://www.behance.net/paharidipak" },
    { label: "Dribbble", href: "https://dribbble.com/dipak-pahari" },
  ],
  [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/iamu/" },
    { label: "Instagram", href: "https://www.instagram.com/i_am_puredevil/?hl=en" },
  ],
] as const;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ───────────── small pieces ───────────── */
/** splits text into words; each word fades from dim to full (the headline reveal in your video) */
function Words({ text, variants }: { text: string; variants: Variants }) {
  return (
    <>
      {text.split(" ").map((w, i, a) => (
        <React.Fragment key={i}>
          <motion.span className={s.word} variants={variants}>
            {w}
          </motion.span>
          {i < a.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </>
  );
}

function Sep() {
  return (
    <span className={s.sep} aria-hidden="true">
      /
    </span>
  );
}

function ArrowCircle() {
  return (
    <a className={s.arrowBtn} href={`mailto:${EMAIL}`} aria-label="Send me an email">
      <svg viewBox="0 0 116 116" fill="none" aria-hidden="true" focusable="false">
        <rect width="116" height="116" rx="58" fill="#141712" />
        <path
          className={s.arrowPath}
          d="M43.638 76.182L39.942 72.486L67.332 45.162H39.48V40.212H73.602L75.714 42.258V76.512H70.764V49.056L43.638 76.182Z"
          fill="#ADEB66"
        />
      </svg>
    </a>
  );
}

function Out({ label, href }: { label: string; href: string }) {
  return (
    <a className={s.link} href={href} target="_blank" rel="noopener noreferrer">
      {label}
      <span className={s.out} aria-hidden="true">
        {" "}
        ↗
      </span>
    </a>
  );
}

/* ───────────── component ───────────── */
export const ContactAndFooter = (): React.ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion();

  // timeline (from your video): block fades up from black → eyebrow + headline reveal word by word → footer items follow
  const root: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: reduce ? 0.2 : 0.6, ease: "easeOut" } },
  };
  const eyebrow: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.07, delayChildren: 0.15 } },
  };
  const title: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: 0.25 } },
  };
  const word: Variants = {
    hidden: { opacity: reduce ? 1 : 0.22 },
    show: { opacity: 1, transition: { duration: 0.4, ease: EASE } },
  };
  const footerItem: Variants = {
    hidden: { opacity: reduce ? 1 : 0 },
    show: (i: number) => ({ opacity: 1, transition: { duration: 0.5, ease: "easeOut", delay: reduce ? 0 : 0.35 + i * 0.07 } }),
  };

  const toTop = () => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });

  return (
    <motion.div ref={ref} className={s.root} variants={root} initial="hidden" animate={inView ? "show" : "hidden"}>
      {/* ───────── contact ───────── */}
      <section className={s.contact} aria-labelledby="contact-title">
        <motion.p className={s.eyebrow} variants={eyebrow}>
          <span className={s.contactDot} aria-hidden="true" />
          <span className={s.contactEyebrowText}>
            <Words text="GOOD THINGS START WITH A CONVERSATION" variants={word} />
          </span>
        </motion.p>

        <div className={s.copy}>
          <motion.h2 id="contact-title" className={s.title} variants={title}>
            <Words text="HAVE A GOOD IDEA?" variants={word} />
            <br />
            <Words text="LET'S MAKE IT REAL." variants={word} />
          </motion.h2>
          <p className={s.description}>A new product, a website, a tricky flow, or just a hello. I&apos;m all ears.</p>
        </div>

        <a className={s.emailLink} href={`mailto:${EMAIL}`}>
          {EMAIL}
        </a>
        <ArrowCircle />
      </section>

      {/* ───────── footer ───────── */}
      <footer className={s.footer}>
        <div className={s.footerContent}>
          <div className={s.brandColumn}>
            <motion.div className={s.brand} variants={footerItem} custom={0}>
              <Image className={s.logo} src={logo} alt="" />
              <div className={s.brandName}>DIPAK PAHARI.</div>
            </motion.div>
            <motion.p className={s.tagline} variants={footerItem} custom={1}>
              A little unexpected. Always human.
            </motion.p>
          </div>

          <motion.nav className={s.group} aria-label="Explore" variants={footerItem} custom={2}>
            <div className={s.groupHeading}>
              <span className={s.footerDot} aria-hidden="true" />
              <span className={s.groupLabel}>EXPLORE</span>
            </div>
            <div className={s.links}>
              <Link className={s.link} href={EXPLORE.home.href}>{EXPLORE.home.label}</Link>
              <Sep />
              <Link className={s.link} href={EXPLORE.work.href}>{EXPLORE.work.label}</Link>
              <br />
              <Link className={s.link} href={EXPLORE.about.href}>{EXPLORE.about.label}</Link>
              <Sep />
              <Link className={s.link} href={EXPLORE.playground.href}>{EXPLORE.playground.label}</Link>
              <span className={s.sepMobile}><Sep /></span>
              <br className={s.brDesktop} />
              <Link className={s.link} href={EXPLORE.contact.href}>{EXPLORE.contact.label}</Link>
            </div>
          </motion.nav>

          <motion.nav className={s.group} aria-label="Elsewhere" variants={footerItem} custom={3}>
            <div className={s.groupHeading}>
              <span className={s.footerDot} aria-hidden="true" />
              <span className={s.groupLabel}>ELSEWHERE</span>
            </div>
            <div className={s.links}>
              {ELSEWHERE.map((row, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  <Out {...row[0]} />
                  <Sep />
                  <Out {...row[1]} />
                </React.Fragment>
              ))}
            </div>
          </motion.nav>
        </div>

        <motion.div className={s.bottom} variants={footerItem} custom={4}>
          <p className={s.copyright}>© 2026 Dipak Pahari. Made with curiosity.</p>
          <button type="button" className={s.backToTop} onClick={toTop}>
            Back to top <span className={s.up} aria-hidden="true">↑</span>
          </button>
        </motion.div>
      </footer>
    </motion.div>
  );
};

export default ContactAndFooter;

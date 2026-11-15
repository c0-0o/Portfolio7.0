"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import AnimatedLogo from "@/components/AnimatedLogo";
import s from "./ContactAndFooter.module.css";

/* ───────────── content (edit here) ───────────── */
const EMAIL = "nexgen.d.pahari@gmail.com";
const EXPLORE = {
  home: { label: "Home", href: "/" },
  work: { label: "Work", href: "/#work" },
  about: { label: "About", href: "/about" },
  playground: { label: "Playground", href: "/playground" },
} as const;
const ELSEWHERE = [
  [
    { label: "Behance", href: "https://www.behance.net/" },
    { label: "Dribbble", href: "https://dribbble.com/" },
  ],
  [
    { label: "LinkedIn", href: "https://www.linkedin.com/" },
    { label: "Instagram", href: "https://www.instagram.com/" },
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
      <Image className={s.arrowImage} src="/Contactarrow.svg" alt="" width={116} height={116} />
    </a>
  );
}

function Out({ label, href }: { label: string; href: string }) {
  return (
    <a className={s.link} href={href} target="_blank" rel="noopener noreferrer">
      {label}
      <Image className={s.out} src="/Sociallinks.svg" alt="" width={9} height={9} />
    </a>
  );
}

/* ───────────── component ───────────── */
export const ContactAndFooter = (): React.ReactElement => {
  const contactRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const contactInView = useInView(contactRef, { once: true, amount: 0.12 });
  const footerInView = useInView(footerRef, { once: true, amount: 0.12 });
  const reduce = useReducedMotion();

  const section: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0.2 : 0.55, ease: "easeOut" } },
  };
  const eyebrow: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.07, delayChildren: reduce ? 0 : 0.15 } },
  };
  const title: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: reduce ? 0 : 0.25 } },
  };
  const word: Variants = {
    hidden: { opacity: reduce ? 1 : 0.22 },
    show: { opacity: 1, transition: { duration: reduce ? 0.01 : 0.4, ease: EASE } },
  };
  const contactItem: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    show: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0.15 : 0.45, ease: EASE, delay: reduce ? 0 : delay },
    }),
  };
  const footerItem: Variants = {
    hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 14 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0.15 : 0.5, ease: "easeOut", delay: reduce ? 0 : 0.2 + i * 0.1 },
    }),
  };

  const toTop = () => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });

  return (
    <div className={s.root}>
      {/* ───────── contact ───────── */}
      <motion.section
        ref={contactRef}
        className={s.contact}
        aria-labelledby="contact-title"
        variants={section}
        initial="hidden"
        animate={contactInView ? "show" : "hidden"}
      >
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
          <motion.p className={s.description} variants={contactItem} custom={0.45}>
            A new product, a website, a tricky flow, or just a hello. I&apos;m all ears.
          </motion.p>
        </div>

        <motion.a className={s.emailLink} href={`mailto:${EMAIL}`} variants={contactItem} custom={0.55}>
          {EMAIL}
        </motion.a>
        <motion.div className={s.arrowWrap} variants={contactItem} custom={0.35}>
          <ArrowCircle />
        </motion.div>
      </motion.section>

      {/* ───────── footer ───────── */}
      <motion.footer
        ref={footerRef}
        className={s.footer}
        variants={section}
        initial="hidden"
        animate={footerInView ? "show" : "hidden"}
      >
        <div className={s.footerContent}>
          <div className={s.brandColumn}>
            <motion.div className={s.brand} variants={footerItem} custom={0}>
              <AnimatedLogo
                className={s.logo}
                size={48}
                interactive
                idleAnimation
                priority
                color="#ADEB66"
                eyeColor="#141712"
                ariaLabel="Dipak Pahari"
              />
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
              <a className={s.link} href={`mailto:${EMAIL}`}>Contact</a>
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
      </motion.footer>
    </div>
  );
};

export default ContactAndFooter;

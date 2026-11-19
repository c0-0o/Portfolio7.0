"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import AnimatedLogo from "@/components/AnimatedLogo";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { markPortfolioVisited, trackPortfolioPathname } from "@/app/components/openingState";
import { NavContactButton } from "@/app/components/NavContactButton";
import s from "./Navigation.module.css";

/* ───────────── content (edit here) ───────────── */
const NAV_LINKS = [
  { label: "Work", href: "/#work" },
  { label: "About", href: "/about" },
  { label: "Playground", href: "/playground" },
  { label: "Contact", href: "mailto:nexgen.d.pahari@gmail.com" },
] as const;
const DESKTOP_LINKS = NAV_LINKS.slice(0, 3);
const EMAIL = "nexgen.d.pahari@gmail.com";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const isActive = (pathname: string, href: string) => href.startsWith("/") && (pathname === href || pathname.startsWith(`${href}/`));

type SitePage = "home" | "about" | "projects" | "playground";

/* ───────────── hamburger ⇄ close icon (your Menu_control.svg, animated) ───────────── */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`${s.icon} ${open ? s.iconOpen : ""}`}
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect className={s.iconRing} x="0.5" y="0.5" width="43" height="43" rx="21.5" />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line className={`${s.line} ${s.l1}`} x1="15.336" x2="28.668" y1="16.166" y2="16.166" />
        <line className={`${s.line} ${s.l2}`} x1="15.336" x2="28.668" y1="22" y2="22" />
        <line className={`${s.line} ${s.l3}`} x1="15.336" x2="28.668" y1="27.834" y2="27.834" />
      </g>
    </svg>
  );
}

/* ───────────── mobile full-screen menu ───────────── */
interface Origin {
  x: number;
  y: number;
  r: number;
}

function MobileMenu({
  pathname,
  activePage,
  origin,
  onClose,
}: {
  pathname: string;
  activePage: SitePage;
  origin: Origin;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // focus: move into the dialog, trap Tab, close on Escape, restore focus on exit
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !rootRef.current) return;
      const f = rootRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const from = `circle(0px at ${origin.x}px ${origin.y}px)`;
  const to = `circle(${origin.r}px at ${origin.x}px ${origin.y}px)`;

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.07, delayChildren: reduce ? 0 : 0.22 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 28 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0.2 : 0.55, ease: EASE } },
  };

  return (
    <motion.div
      ref={rootRef}
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className={s.overlay}
      initial={reduce ? { opacity: 0 } : { clipPath: from }}
      animate={reduce ? { opacity: 1 } : { clipPath: to }}
      exit={reduce ? { opacity: 0 } : { clipPath: from, transition: { duration: 0.45, ease: [0.64, 0, 0.78, 0] } }}
      transition={{ duration: reduce ? 0.2 : 0.7, ease: EASE }}
    >
      <div className={s.overlayHeader}>
        <AnimatedLogo href="/" onClick={onClose} size={44} interactive idleAnimation priority ariaLabel="Dipak Pahari, home" />
        <button ref={closeRef} type="button" className={s.menuBtn} onClick={onClose} aria-label="Close menu">
          <span className={s.menuLabel}>Close</span>
          <MenuIcon open />
        </button>
      </div>

      <motion.div className={s.overlayContent} variants={container} initial="hidden" animate="show" exit="exit">
        <div className={s.section}>
          <motion.div className={s.heading} variants={item}>
            <div className={s.whereTo}>
              <span className={s.dot} />
              <span className={s.whereLabel}>WHERE TO?</span>
            </div>
            <Link href="/" className={s.homeLink} onClick={onClose}>
              Home ↗
            </Link>
          </motion.div>

          <ul className={s.rows}>
            {NAV_LINKS.map((l) => {
              const active = l.label === "Work"
                ? activePage === "home" || activePage === "projects"
                : isActive(pathname, l.href);
              return (
                <motion.li key={l.href} variants={item}>
                  <Link
                    href={l.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`${s.row} ${active ? s.rowActive : ""}`}
                  >
                    <span className={`${s.rowLabel} ${l.label === "Playground" ? s.rowLabelSm : ""}`}>{l.label}</span>
                    <span className={s.rowArrow} aria-hidden="true">
                      ↗
                    </span>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </div>

        <motion.div className={s.contact} variants={item}>
          <div className={s.contactHeading}>
            <a href={`mailto:${EMAIL}`} onClick={onClose} className={s.contactTitle}>
              LET&apos;S TALK.
            </a>
            <span className={s.contactArrow} aria-hidden="true">
              ↗
            </span>
          </div>
          <a className={s.emailLink} href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <p className={s.copyright}>© 2026 Dipak Pahari. Made with curiosity.</p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ───────────── navigation ───────────── */
export const Navigation = ({ activePage }: { activePage: SitePage }): React.ReactElement => {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<Origin>({ x: 0, y: 0, r: 2000 });
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    markPortfolioVisited();
    trackPortfolioPathname(pathname);
  }, [pathname]);

  const openMenu = () => {
    const rect = menuBtnRef.current?.getBoundingClientRect();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = rect ? rect.left + rect.width / 2 : w - 46;
    const y = rect ? rect.top + rect.height / 2 : 42;
    setOrigin({ x, y, r: Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 8 });
    setOpen(true);
  };

  // lock page scroll while the menu is open
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  // growing to desktop width → close the mobile menu
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 820px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <header className={s.root}>
      {/* route-change progress bar */}
      {!reduce && (
        <motion.div
          key={pathname}
          className={s.progress}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: [1, 1, 0] }}
          transition={{ duration: 0.8, ease: EASE, opacity: { duration: 0.8, times: [0, 0.7, 1] } }}
          aria-hidden="true"
        />
      )}

      {/* desktop */}
      <nav className={s.desktop} aria-label="Main">
        <MagneticTarget id="wordmark" as="span" priority={2}>
          <AnimatedLogo href="/" size={44} interactive idleAnimation priority ariaLabel="Dipak Pahari, home" />
        </MagneticTarget>
        <div className={s.actions}>
          <div className={s.links}>
            {DESKTOP_LINKS.map((l) => {
              const active = l.label === "Work"
                ? activePage === "home" || activePage === "projects"
                : isActive(pathname, l.href);
              return (
                <span key={l.href} className={s.linkWrap}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`${s.link} ${active ? s.linkActive : ""}`}
                  >
                    {l.label}
                  </Link>
                  {active && (
                    <motion.span
                      layoutId="nav-indicator"
                      className={s.indicator}
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                </span>
              );
            })}
          </div>
          <NavContactButton />
        </div>
      </nav>

      {/* mobile bar */}
      <div className={s.mobile}>
        <AnimatedLogo href="/" size={44} interactive idleAnimation priority ariaLabel="Dipak Pahari, home" />
        <button
          ref={menuBtnRef}
          type="button"
          className={s.menuBtn}
          onClick={openMenu}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Open menu"
        >
          <span className={s.menuLabel}>Menu</span>
          <MenuIcon open={false} />
        </button>
      </div>

      <AnimatePresence>
        {open && <MobileMenu key="menu" pathname={pathname} activePage={activePage} origin={origin} onClose={close} />}
      </AnimatePresence>
    </header>
  );
};

export default Navigation;

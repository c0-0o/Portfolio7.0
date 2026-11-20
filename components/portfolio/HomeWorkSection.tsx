"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortfolioActionButton } from "./PortfolioActionButton";
import styles from "./HomeWorkSection.module.css";

const featuredProjects = [
  {
    id: "em-collection",
    title: "EM COLLECTION",
    href: "/work/em-collection",
    year: "2026",
    category: "01 / PRODUCT DESIGN + DEVELOPMENT",
    summary:
      "Ecommerce UI/UX design and full-stack development, focused on clear product discovery and a straightforward checkout.",
    image: "/emcollectionthumbnail.png",
    visual: "cover",
    details: [
      {
        label: "THE CHALLENGE",
        text: "How can shoppers quickly discover relevant products and find the information they need before moving to cart and checkout?",
      },
      {
        label: "THE SOLUTION",
        text: "Make product discovery, product details, and checkout steps feel clear, easy to follow, and simple to complete.",
      },
      {
        label: "WHAT I'D TEST",
        text: "Can shoppers quickly find products, understand the details, and move through checkout without confusion?",
      },
    ],
  },
  {
    id: "xfog-of-war",
    title: "XFog of War",
    href: "/work/xfog-of-war",
    year: "2026",
    category: "02 / BROWSER GAME / UI & ICON DESIGN",
    summary:
      "A browser-based chess game with a designed game interface and custom chess-piece icon set.",
    visual: "chess",
    details: [
      {
        label: "THE CHALLENGE",
        text: "Keep the chess board and game state readable while players focus on the match.",
      },
      {
        label: "THE SOLUTION",
        text: "Design the browser interface and chess-piece artwork together for a cohesive game experience.",
      },
      {
        label: "WHAT I'D TEST",
        text: "Can players identify pieces, follow the board, and make their next move confidently?",
      },
    ],
  },
  {
    id: "codynn",
    title: "CODINN",
    href: "/work/codynn",
    year: "2025",
    category: "03 / HOMEPAGE REDESIGN / UX RESEARCH",
    summary:
      "A homepage redesign informed by competitor research, user personas, and user journey mapping.",
    visual: "codynn",
    details: [
      {
        label: "THE CHALLENGE",
        text: "Help visitors understand Codynn and find a relevant next step on their first visit.",
      },
      {
        label: "THE SOLUTION",
        text: "Use research, personas, and journey mapping to guide the homepage structure and content priorities.",
      },
      {
        label: "WHAT I'D TEST",
        text: "Can visitors understand the offer and find a useful path forward without confusion?",
      },
    ],
  },
] as const;

type FeaturedProject = (typeof featuredProjects)[number];

function ProjectArtwork({ project, compact = false }: { project: FeaturedProject; compact?: boolean }) {
  if (compact) {
    if (project.visual === "cover") {
      return (
        <Image
          className={styles.projectCardImage}
          src={project.image}
          alt=""
          fill
          sizes="(max-width: 560px) 30vw, 260px"
        />
      );
    }

    return <span className={styles.projectThumbnailArtwork} aria-hidden="true" />;
  }

  if (project.visual === "cover") {
    return (
      <Image
        className={styles.featuredImage}
        src={project.image}
        alt=""
        fill
        sizes="(max-width: 800px) 100vw, 42vw"
      />
    );
  }

  const posterClassName = styles.projectPoster;

  if (project.visual === "chess") {
    return (
      <div className={`${posterClassName} ${styles.chessPoster}`} aria-hidden="true">
        <span className={styles.posterEyebrow}>BROWSER GAME / UI & ICON DESIGN</span>
        <span className={styles.chessPosterTitle}>XFOG OF WAR</span>
        <div className={styles.chessBoard}>
          {Array.from({ length: 64 }, (_, square) => (
            <span
              className={styles.chessSquare}
              data-tone={(Math.floor(square / 8) + square % 8) % 2 === 0 ? "light" : "dark"}
              key={square}
            />
          ))}
        </div>
        <span className={styles.chessPiece}>♞</span>
        <span className={styles.chessPosterNote}>CHESS, DESIGNED FOR THE BROWSER</span>
      </div>
    );
  }

  return (
    <div className={`${posterClassName} ${styles.codynnPoster}`} aria-hidden="true">
      <span className={styles.posterEyebrow}>HOMEPAGE REDESIGN / UX RESEARCH</span>
      <span className={styles.codynnWordmark}>CODINN<span>.</span></span>
      <span className={styles.codynnPosterTitle}>A HOMEPAGE BUILT AROUND PEOPLE.</span>
      <div className={styles.codynnBlocks}>
        <span />
        <span />
        <span />
      </div>
      <span className={styles.codynnPosterNote}>RESEARCH · PERSONAS · JOURNEYS</span>
    </div>
  );
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      setTimeout(() => setInView(true), 0);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, inView] as const;
}

export default function HomeWorkSection() {
  const [featuredRef, featuredInView] = useInView<HTMLElement>();
  const [projectPickerRef, projectPickerInView] = useInView<HTMLDivElement>();
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [pickerScrollProgress, setPickerScrollProgress] = useState(0);
  const [pickerHasOverflow, setPickerHasOverflow] = useState(false);
  const activeProject = featuredProjects[activeProjectIndex];

  const updatePickerScroll = useCallback((picker: HTMLDivElement) => {
    const maxScroll = Math.max(0, picker.scrollWidth - picker.clientWidth);
    setPickerHasOverflow(maxScroll > 1);
    setPickerScrollProgress(maxScroll > 1 ? picker.scrollLeft / maxScroll : 0);
  }, []);

  useEffect(() => {
    const picker = projectPickerRef.current;
    if (!picker) return;

    const handleResize = () => updatePickerScroll(picker);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [projectPickerRef, updatePickerScroll]);

  useEffect(() => {
    const picker = projectPickerRef.current;
    const selectedCard = picker?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!picker || !selectedCard) return;

    const pickerBounds = picker.getBoundingClientRect();
    const cardBounds = selectedCard.getBoundingClientRect();

    if (cardBounds.left < pickerBounds.left) {
      picker.scrollTo({
        left: picker.scrollLeft + cardBounds.left - pickerBounds.left,
        behavior: "smooth",
      });
    } else if (cardBounds.right > pickerBounds.right) {
      picker.scrollTo({
        left: picker.scrollLeft + cardBounds.right - pickerBounds.right,
        behavior: "smooth",
      });
    }
  }, [activeProjectIndex, projectPickerRef]);

  const changeProject = (direction: -1 | 1) => {
    setActiveProjectIndex((current) =>
      (current + direction + featuredProjects.length) % featuredProjects.length,
    );
  };

  return (
    <section id="work" className={styles.selectedWork} aria-labelledby="work-heading">
      <h2 id="work-heading" className={styles.heading}>
        MY WORKS.
      </h2>

      <div className={styles.worksList}>
        <article
          id="featured-project"
          data-project={activeProject.id}
          ref={featuredRef}
          className={`${styles.featuredWork} ${featuredInView ? styles.inView : ""}`}
        >
          <Link
            key={`${activeProject.id}-visual`}
            className={styles.featuredVisual}
            href={activeProject.href}
            aria-label={`Open the ${activeProject.title} case study`}
          >
            <span className={styles.featuredBacking} aria-hidden="true" />
            <span className={styles.featuredArtwork} key={`${activeProject.id}-artwork`}>
              <ProjectArtwork project={activeProject} />
            </span>
            <span className={styles.featuredAccent} aria-hidden="true" />
            <span className={styles.featuredSparkle} aria-hidden="true">✦</span>
          </Link>

          <div className={styles.workDetails}>
            <div className={styles.workMeta}>
              <p className={styles.workCategory}>{activeProject.category}</p>
              <div className={styles.projectNavigation} role="group" aria-label="Featured project navigation">
                <button
                  className={`${styles.navButton} ${styles.previous}`}
                  type="button"
                  aria-label="Show previous project"
                  aria-controls="featured-project"
                  onClick={() => changeProject(-1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 12H5m7 7-7-7 7-7" />
                  </svg>
                </button>
                <span className={styles.projectPosition} aria-live="polite" aria-atomic="true">
                  {String(activeProjectIndex + 1).padStart(2, "0")} / {String(featuredProjects.length).padStart(2, "0")}
                  <span className={styles.screenReaderOnly}>: {activeProject.title}</span>
                </span>
                <button
                  className={`${styles.navButton} ${styles.next}`}
                  type="button"
                  aria-label="Show next project"
                  aria-controls="featured-project"
                  onClick={() => changeProject(1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14m-7-7 7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className={styles.projectDetails} key={`${activeProject.id}-details`}>
              <div className={styles.workOverview}>
                <div className={styles.workCopy}>
                  <div className={styles.workDescription}>
                    <h3 className={styles.workTitle} id="featured-project-title">{activeProject.title}</h3>
                    <p className={styles.workSummary}>{activeProject.summary}</p>
                  </div>
                </div>
                <Link
                  className={styles.externalLink}
                  href={activeProject.href}
                  aria-label={`Learn more about the ${activeProject.title} case study`}
                >
                  <Image
                    src="/Case study link.svg"
                    alt=""
                    width={64}
                    height={64}
                  />
                </Link>
              </div>

              <div className={styles.caseStudyDetails}>
                {activeProject.details.map(({ label, text }) => (
                  <div className={styles.caseStudyColumn} key={label}>
                    <h4 className={styles.caseStudyLabel}>{label}</h4>
                    <p className={styles.caseStudyText}>{text}</p>
                  </div>
                ))}
              </div>

              <div className={styles.caseStudyActions}>
                <PortfolioActionButton to={activeProject.href} label="Learn case study" />
                <span className={styles.divider} aria-hidden="true" />
                <a
                  className={styles.behanceLink}
                  href="https://www.behance.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View my Behance profile"
                >
                  Bē
                </a>
              </div>
            </div>
          </div>
        </article>
        <div className={styles.projectPickerGroup}>
          <div
            ref={projectPickerRef}
            id="project-picker"
            className={`${styles.projectPicker} ${projectPickerInView ? styles.inView : ""}`}
            role="group"
            aria-label="Choose a featured project"
            onScroll={(event) => updatePickerScroll(event.currentTarget)}
          >
            {featuredProjects.map((project, index) => {
              const selected = index === activeProjectIndex;

              return (
                <button
                  className={`${styles.projectCard}${selected ? ` ${styles.projectCardActive}` : ""}`}
                  type="button"
                  aria-label={`Show ${project.title} as the featured project`}
                  aria-pressed={selected}
                  aria-controls="featured-project"
                  onClick={() => setActiveProjectIndex(index)}
                  key={project.id}
                >
                  <span className={styles.projectCardYear}>{project.year}</span>
                  <span className={styles.projectCardVisual}>
                    <ProjectArtwork project={project} compact />
                    <span className={styles.projectCardDot} aria-hidden="true" />
                  </span>
                  <span className={styles.projectCardTitle}>{project.title}</span>
                </button>
              );
            })}
          </div>
          {pickerHasOverflow && (
            <input
              className={styles.projectPickerScrollControl}
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(pickerScrollProgress * 100)}
              aria-label="Scroll project cards"
              aria-controls="project-picker"
              onChange={(event) => {
                const picker = projectPickerRef.current;
                if (!picker) return;

                const maxScroll = picker.scrollWidth - picker.clientWidth;
                picker.scrollTo({
                  left: (Number(event.currentTarget.value) / 100) * maxScroll,
                  behavior: "smooth",
                });
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

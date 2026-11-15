"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PortfolioActionButton } from "./PortfolioActionButton";
import styles from "./HomeWorkSection.module.css";

const caseStudyDetails = [
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
];

const earlierProjects = [
  { title: "XFog of War", href: "/work/xfog-of-war" },
  { title: "Codynn", href: "/work/codynn" },
];

const totalProjectCount = earlierProjects.length + 1;

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
  const [olderWorkRef, olderWorkInView] = useInView<HTMLDivElement>();
  const projectListRef = useRef<HTMLDivElement>(null);

  const scrollProjects = (direction: -1 | 1) => {
    const projectList = projectListRef.current;
    if (!projectList) return;

    projectList.scrollBy({
      left: direction * projectList.clientWidth * 0.82,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  return (
    <section id="work" className={styles.selectedWork} aria-labelledby="work-heading">
      <h2 id="work-heading" className={styles.heading}>
        MY WORKS.
      </h2>

      <div className={styles.worksList}>
        <article
          ref={featuredRef}
          className={`${styles.featuredWork} ${featuredInView ? styles.inView : ""}`}
        >
          <Link
            className={styles.featuredVisual}
            href="/work/em-collection"
            aria-label="Open the EM Collection case study"
          >
            <div className={styles.backgroundShape} />
            <Image
              className={styles.architectureImage}
              src="/portfolio/architecture.png"
              alt=""
              width={430}
              height={389}
              sizes="(max-width: 800px) 85vw, 40vw"
            />
            <div className={styles.darkSquare} />
            <span className={styles.sparkle}>✦</span>
          </Link>

          <div className={styles.workDetails}>
            <div className={styles.workIntro}>
              <p className={styles.workCategory}>01 / PRODUCT DESIGN + DEVELOPMENT</p>
              <div className={styles.workOverview}>
                <div className={styles.workCopy}>
                  <div className={styles.workDescription}>
                    <h3 className={styles.workTitle}>EM COLLECTION</h3>
                    <p className={styles.workSummary}>
                      Ecommerce UI/UX design and full-stack development, focused on clear product
                      discovery and a straightforward checkout.
                    </p>
                  </div>
                </div>
                <Link
                  className={styles.externalLink}
                  href="/work/em-collection"
                  aria-label="Learn more about the EM Collection case study"
                >
                  <Image
                    src="/Case study link.svg"
                    alt=""
                    width={64}
                    height={64}
                  />
                </Link>
              </div>
            </div>

            <div className={styles.caseStudyDetails}>
              {caseStudyDetails.map(({ label, text }) => (
                <div className={styles.caseStudyColumn} key={label}>
                  <h4 className={styles.caseStudyLabel}>{label}</h4>
                  <p className={styles.caseStudyText}>{text}</p>
                </div>
              ))}
            </div>

            <div className={styles.caseStudyActions}>
              <PortfolioActionButton to="/work/em-collection" label="Learn case study" />
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
        </article>

        <div
          ref={olderWorkRef}
          className={`${styles.olderWorks} ${olderWorkInView ? styles.inView : ""}`}
          aria-label="More selected projects"
        >
          <div className={styles.olderWorkHeading}>
            <div>
              <p className={styles.olderWorkLabel}>02 / MORE SELECTED WORK</p>
              <p className={styles.olderWorkNote}>{totalProjectCount} projects</p>
            </div>
            <div className={styles.cardsNav} role="group" aria-label="Project carousel controls">
              <button
                className={`${styles.navButton} ${styles.previous}`}
                type="button"
                aria-label="Scroll to previous projects"
                onClick={() => scrollProjects(-1)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 12H5m7 7-7-7 7-7" />
                </svg>
              </button>
              <button
                className={`${styles.navButton} ${styles.next}`}
                type="button"
                aria-label="Scroll to next projects"
                onClick={() => scrollProjects(1)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14m-7-7 7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div
            ref={projectListRef}
            className={styles.projectViewport}
            role="region"
            aria-label="XFog of War and Codynn case studies"
            tabIndex={0}
          >
            <div className={styles.projectGrid}>
              {earlierProjects.map((project) => (
                <Link
                  className={styles.projectCard}
                  href={project.href}
                  aria-label={`View the ${project.title} case study`}
                  key={project.title}
                >
                  <span className={styles.cardYear}>2025</span>
                  <span className={styles.cardShape} aria-hidden="true">
                    <span className={styles.cardArtwork} />
                    <span className={styles.cardDot} />
                    <span className={styles.cardTitle}>{project.title}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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
    caseStudyHref: "/work/em-collection",
    behanceHref: "https://www.behance.net/gallery/257917561/EM-Collection",
    year: "2026",
    category: "Client Work",
    summary:
      "Ecommerce UI/UX design and full-stack development, creating a seamless shopping experience from product discovery to order completion.",
    image: "/thumbnails/emcollection-thumbnail.png",
    unoptimized: true,
    tags: ["Ecommerce", "UI/UX Design", "FullStack Development", "Responsive Design"],
    details: [
      {
        label: "THE PROBLEM",
        text: "Unclear product information and complicated checkout experiences can lead to abandoned purchases.",
      },
      {
        label: "THE CHALLENGE",
        text: "Help shoppers find the right footwear and make confident purchase decisions without unnecessary steps.",
      },
      {
        label: "THE SOLUTION",
        text: "Provide helpful product details, guest checkout, and optional account creation with benefits introduced after purchase.",
      },
    ],
  },
  {
    id: "xfog-of-war",
    title: "XFOG OF WAR",
    caseStudyHref: "/work/xfog-of-war",
    behanceHref: "https://www.behance.net/gallery/258780035/XFog-Of-War",
    year: "2026",
    category: "Team Project",
    summary:
      "A fog-of-war chess experience with clearer rules, custom pieces and a board-first interface for desktop and mobile.",
    image: "/thumbnails/play-now-square.webp",
    imageFit: "contain",
    thumbnailImageFit: "fill",
    tags: ["Game Design", "Chess", "UI/UX Design", "Icon Design"],
    details: [
      {
        label: "THE PROBLEM",
        text: "Balancing chess pieces, board colors, fog, and new gameplay elements without making the board visually overwhelming.",
      },
      {
        label: "THE CHALLENGE",
        text: "Introduce new mechanics without disrupting gameplay or making the game difficult for new players to understand.",
      },
      {
        label: "THE SOLUTION",
        text: "Custom chess pieces, a board-first layout, visual guidance, and separate tutorials for basic chess and Fog of War rules.",
      },
    ],
  },
  {
    id: "irevise",
    title: "IREVISE",
    caseStudyHref: "/work/irevise",
    behanceHref: "https://www.behance.net/gallery/258780693/iRevise?platform=direct",
    year: "2025",
    category: "Client Work",
    summary:
      "A teacher-led learning platform connecting exam creation, student practice, and meaningful feedback across desktop and mobile.",
    image: "/thumbnails/irevise-behance.webp",
    imageFit: "cover",
    thumbnailImageFit: "cover",
    imageBackground: "light",
    featuredImage: "/thumbnails/irevise-behance-large.webp",
    unoptimized: true,
    tags: ["EdTech", "UX research", "Product design", "UI Design"],
    details: [
      {
        label: "THE PROBLEM",
        text: "The previous platform had useful features but lacked the information and resources teachers needed to create exams easily and accurately.",
      },
      {
        label: "THE CHALLENGE",
        text: "Balance the different needs of teachers, students, and parents while keeping the experience simple and aligned with business goals.",
      },
      {
        label: "THE SOLUTION",
        text: "Create simplified, role-based experiences with focused workflows for exam creation, student learning, and parent progress tracking.",
      },
    ],
  },
] as const;

type FeaturedProject = (typeof featuredProjects)[number];

function ProjectArtwork({ project, compact = false }: { project: FeaturedProject; compact?: boolean }) {
  return (
    <Image
      className={
        compact
          ? [
              styles.projectCardImage,
              "thumbnailImageFit" in project && project.thumbnailImageFit === "cover"
                ? styles.projectCardImageCover
                : "thumbnailImageFit" in project && project.thumbnailImageFit === "fill"
                  ? styles.projectCardImageFill
                  : "",
              "imageBackground" in project && project.imageBackground === "light"
                ? styles.imageBackgroundLight
                : "",
            ]
              .filter(Boolean)
              .join(" ")
          : [
              styles.featuredImage,
              "imageFit" in project && project.imageFit === "contain"
                ? styles.featuredImageContain
                : "",
              "imageBackground" in project && project.imageBackground === "light"
                ? styles.imageBackgroundLight
                : "",
            ]
              .filter(Boolean)
              .join(" ")
      }
      src={!compact && "featuredImage" in project ? project.featuredImage : project.image}
      alt={`${project.title} project preview`}
      fill
      unoptimized={"unoptimized" in project && project.unoptimized}
      sizes={compact ? "(max-width: 560px) 30vw, 260px" : "(max-width: 800px) 100vw, 42vw"}
    />
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

function FeaturedProjectDetails({
  project,
  activeProjectIndex,
  projectCount,
  caseStudyHref,
  behanceHref,
  projectHref,
  onChangeProject,
}: {
  project: FeaturedProject;
  activeProjectIndex: number;
  projectCount: number;
  caseStudyHref?: string;
  behanceHref?: string;
  projectHref: string;
  onChangeProject: (direction: -1 | 1) => void;
}) {
  return (
    <div className={styles.workDetails}>
      <div className={styles.workMeta}>
        <p className={styles.workCategory}>{project.year} / {project.category}</p>
        <div className={styles.projectNavigation} role="group" aria-label="Featured project navigation">
          <button
            className={`${styles.navButton} ${styles.previous}`}
            type="button"
            aria-label="Show previous project"
            aria-controls="featured-project"
            onClick={() => onChangeProject(-1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5m7 7-7-7 7-7" />
            </svg>
          </button>
          <span className={styles.projectPosition} aria-live="polite" aria-atomic="true">
            {String(activeProjectIndex + 1).padStart(2, "0")} / {String(projectCount).padStart(2, "0")}
            <span className={styles.screenReaderOnly}>: {project.title}</span>
          </span>
          <button
            className={`${styles.navButton} ${styles.next}`}
            type="button"
            aria-label="Show next project"
            aria-controls="featured-project"
            onClick={() => onChangeProject(1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14m-7-7 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.projectDetails}>
        <div className={styles.workOverview}>
          <div className={styles.workCopy}>
            <div className={styles.workDescription}>
              <h3 className={styles.workTitle} id="featured-project-title">{project.title}</h3>
              <p className={styles.workSummary}>{project.summary}</p>
              <ul className={styles.projectTags} aria-label={`${project.title} project areas`}>
                {project.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
          </div>
          <Link
            className={styles.externalLink}
            href={projectHref}
            target={caseStudyHref ? undefined : "_blank"}
            rel={caseStudyHref ? undefined : "noopener noreferrer"}
            aria-label={
              caseStudyHref
                ? `Learn more about the ${project.title} case study`
                : `View ${project.title} on Behance`
            }
          >
            <Image src="/Case study link.svg" alt="" width={64} height={64} />
          </Link>
        </div>

        <div className={styles.caseStudyDetails}>
          {project.details.map(({ label, text }) => (
            <div className={styles.caseStudyColumn} key={label}>
              <h4 className={styles.caseStudyLabel}>{label}</h4>
              <p className={styles.caseStudyText}>{text}</p>
            </div>
          ))}
        </div>

        <div className={styles.caseStudyActions}>
          {caseStudyHref ? (
            <PortfolioActionButton to={caseStudyHref} label="Learn case study" />
          ) : (
            <PortfolioActionButton to={projectHref} label="Learn case study" target="_blank" />
          )}
          <span className={styles.divider} aria-hidden="true" />
          <a
            className={styles.behanceLink}
            href={behanceHref ?? "https://www.behance.net/"}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={behanceHref ? `View ${project.title} on Behance` : "View my Behance profile"}
          >
            Bē
          </a>
        </div>
      </div>
    </div>
  );
}

export default function HomeWorkSection() {
  const [featuredRef, featuredInView] = useInView<HTMLElement>();
  const [projectPickerRef, projectPickerInView] = useInView<HTMLDivElement>();
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [pickerScrollProgress, setPickerScrollProgress] = useState(0);
  const [pickerHasOverflow, setPickerHasOverflow] = useState(false);
  const activeProject = featuredProjects[activeProjectIndex];
  const caseStudyHref = "caseStudyHref" in activeProject ? activeProject.caseStudyHref : undefined;
  const behanceHref = "behanceHref" in activeProject ? activeProject.behanceHref : undefined;
  const projectHref = caseStudyHref ?? behanceHref ?? "https://www.behance.net/";

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
            className={styles.featuredVisual}
            href={projectHref}
            target={caseStudyHref ? undefined : "_blank"}
            rel={caseStudyHref ? undefined : "noopener noreferrer"}
            aria-label={
              caseStudyHref
                ? `Open the ${activeProject.title} case study`
                : `View ${activeProject.title} on Behance`
            }
          >
            <span className={styles.featuredBacking} aria-hidden="true" />
            <span className={styles.featuredArtwork}>
              <ProjectArtwork project={activeProject} />
            </span>
            <span className={styles.featuredAccent} aria-hidden="true" />
            <span className={styles.featuredSparkle} aria-hidden="true">✦</span>
          </Link>

          <FeaturedProjectDetails
            project={activeProject}
            activeProjectIndex={activeProjectIndex}
            projectCount={featuredProjects.length}
            caseStudyHref={caseStudyHref}
            behanceHref={behanceHref}
            projectHref={projectHref}
            onChangeProject={changeProject}
          />
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
                  {project.year && <span className={styles.projectCardYear}>{project.year}</span>}
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

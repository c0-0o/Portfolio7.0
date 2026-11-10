"use client";

import { useState } from "react";

const categories = ["All", "Drawing", "Pixel art", "Animation"] as const;
type CreativeCategory = (typeof categories)[number];

const pieces = [
  {
    category: "Drawing",
    number: "01",
    title: "A study in slow lines",
    description: "Loose contours, soft shapes, and the pleasure of leaving a line imperfect.",
    label: "DRAWING / LINE STUDY",
  },
  {
    category: "Pixel art",
    number: "02",
    title: "Somewhere, after sunset",
    description: "A tiny landscape built one little square at a time.",
    label: "PIXEL ART / SMALL WORLD",
  },
  {
    category: "Animation",
    number: "03",
    title: "Orbit, then drift",
    description: "A small looping motion test exploring rhythm, pause, and return.",
    label: "ANIMATION / MOTION TEST",
  },
] as const;

const pixelArtwork: [number, number, string][] = [
  [5, 1, "#f7d781"], [6, 1, "#f7d781"], [4, 2, "#f7d781"], [5, 2, "#fff0bc"], [6, 2, "#fff0bc"], [7, 2, "#f7d781"],
  [2, 4, "#547a74"], [3, 4, "#547a74"], [4, 4, "#547a74"], [8, 4, "#547a74"], [9, 4, "#547a74"],
  [1, 5, "#385d5b"], [2, 5, "#547a74"], [3, 5, "#668d78"], [4, 5, "#547a74"], [8, 5, "#668d78"], [9, 5, "#547a74"], [10, 5, "#385d5b"],
  [0, 6, "#385d5b"], [1, 6, "#547a74"], [2, 6, "#668d78"], [3, 6, "#82a27c"], [4, 6, "#668d78"], [5, 6, "#547a74"], [7, 6, "#547a74"], [8, 6, "#668d78"], [9, 6, "#82a27c"], [10, 6, "#547a74"], [11, 6, "#385d5b"],
  [0, 7, "#294847"], [1, 7, "#385d5b"], [2, 7, "#547a74"], [3, 7, "#668d78"], [4, 7, "#547a74"], [5, 7, "#385d5b"], [6, 7, "#294847"], [7, 7, "#385d5b"], [8, 7, "#547a74"], [9, 7, "#668d78"], [10, 7, "#547a74"], [11, 7, "#385d5b"],
  [1, 8, "#385d5b"], [2, 8, "#547a74"], [3, 8, "#668d78"], [4, 8, "#547a74"], [5, 8, "#385d5b"], [6, 8, "#294847"], [7, 8, "#385d5b"], [8, 8, "#547a74"], [9, 8, "#668d78"], [10, 8, "#547a74"],
  [2, 9, "#385d5b"], [3, 9, "#547a74"], [4, 9, "#385d5b"], [8, 9, "#385d5b"], [9, 9, "#547a74"], [10, 9, "#385d5b"],
];

function Artwork({ category }: { category: (typeof pieces)[number]["category"] }) {
  if (category === "Drawing") {
    return (
      <svg className="creative-svg drawing-svg" viewBox="0 0 480 340" role="img" aria-label="Abstract continuous-line drawing">
        <path className="drawing-halo" d="M92 183c9-68 57-122 126-127 69-5 119 42 126 107 7 66-33 131-101 144-71 14-137-27-151-91" />
        <path className="drawing-line" d="M173 278c-15-26-26-55-27-85-2-43 21-79 54-96 35-18 77-10 99 17 20 24 20 63 1 87-20 25-53 34-82 24-24-9-39-29-39-49 1-24 19-43 42-46 17-2 33 4 41 16 8 11 8 27 1 39-9 13-27 17-41 10-10-5-16-16-14-27 2-9 9-16 18-17" />
        <path className="drawing-accent" d="M203 255c21 20 50 31 79 30m-119-19c-20 14-36 33-46 55m193-192c16-16 37-27 58-31" />
        <circle className="drawing-dot" cx="197" cy="113" r="5" />
        <circle className="drawing-dot drawing-dot-two" cx="304" cy="238" r="3" />
      </svg>
    );
  }

  if (category === "Pixel art") {
    return (
      <svg className="creative-svg pixel-svg" viewBox="0 0 480 340" role="img" aria-label="Pixel-art sunset over a small landscape">
        <rect width="480" height="340" fill="#d9e8d8" />
        <rect x="0" y="214" width="480" height="126" fill="#b3c9b0" />
        <circle cx="250" cy="120" r="60" fill="#f3c66e" />
        <g shapeRendering="crispEdges">
          {pixelArtwork.map(([x, y, color], index) => (
            <rect key={index} x={x * 28 + 66} y={y * 18 + 86} width="28" height="18" fill={color} />
          ))}
          <rect x="108" y="266" width="28" height="36" fill="#55776e" />
          <rect x="360" y="250" width="28" height="52" fill="#55776e" />
          <rect x="332" y="278" width="28" height="24" fill="#668d78" />
        </g>
        <path d="M0 266h84v-18h56v18h56v-18h56v18h84v-18h84v92H0z" fill="#76967d" />
        <path d="M0 302h112v-18h56v18h84v-18h56v18h56v-18h116v56H0z" fill="#54766c" />
      </svg>
    );
  }

  return (
    <svg className="creative-svg motion-svg" viewBox="0 0 480 340" role="img" aria-label="Abstract animated orbit study">
      <circle className="motion-orbit motion-orbit-one" cx="240" cy="170" r="104" />
      <circle className="motion-orbit motion-orbit-two" cx="240" cy="170" r="73" />
      <circle className="motion-center" cx="240" cy="170" r="28" />
      <circle className="motion-satellite" cx="240" cy="66" r="11" />
      <circle className="motion-satellite motion-satellite-small" cx="167" cy="170" r="6" />
      <path className="motion-swoop" d="M96 214c47 58 110 86 178 67 50-14 82-50 110-88" />
      <circle className="motion-swoop-dot" cx="384" cy="193" r="5" />
    </svg>
  );
}

export function CreativeGallery() {
  const [activeCategory, setActiveCategory] = useState<CreativeCategory>("All");
  const visiblePieces = activeCategory === "All"
    ? pieces
    : pieces.filter((piece) => piece.category === activeCategory);

  return (
    <>
      <div className="creative-filters" role="group" aria-label="Filter creative work">
        {categories.map((category) => (
          <button
            aria-pressed={activeCategory === category}
            className={activeCategory === category ? "creative-filter is-active" : "creative-filter"}
            key={category}
            onClick={() => setActiveCategory(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>
      <div className="creative-grid" aria-live="polite">
        {visiblePieces.map((piece) => (
          <article className="creative-card" key={piece.number}>
            <div className={`creative-art creative-art-${piece.number}`} aria-label={piece.label}>
              <span className="creative-art-label">{piece.label}</span>
              <Artwork category={piece.category} />
              <span className="creative-art-number">{piece.number}</span>
            </div>
            <div className="creative-card-copy">
              <p className="portfolio-eyebrow">{piece.category}</p>
              <h2>{piece.title}</h2>
              <p>{piece.description}</p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

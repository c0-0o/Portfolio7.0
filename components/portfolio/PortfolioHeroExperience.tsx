"use client";

import { useRef } from "react";
import Hero, { type HeroHandle } from "./hero/Hero";
import PortfolioIntro from "./intro/PortfolioIntro";

interface PortfolioHeroExperienceProps {
  once?: boolean;
}

export default function PortfolioHeroExperience({ once = true }: PortfolioHeroExperienceProps) {
  const hero = useRef<HeroHandle>(null);

  return (
    <>
      <Hero ref={hero} />
      <PortfolioIntro getHero={() => hero.current} once={once} />
    </>
  );
}

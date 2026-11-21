import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "@/components/Navigation/SiteNav";
import ContactAndFooter from "./ContactAndFooter";
import { PortfolioActionButton } from "./PortfolioActionButton";

type SitePage = "home" | "about" | "projects" | "playground";

export function SectionLabel({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "lime";
}) {
  return (
    <div className="flex items-center gap-2 md:gap-2.5">
      <span className="size-1.5 shrink-0 bg-lime md:size-1.75" />
      <span
        className={`text-[10px] leading-normal font-bold tracking-[1px] uppercase md:text-xs md:tracking-[1.5px] ${
          tone === "lime" ? "text-lime" : "text-muted"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

export function Tag({
  children,
  active,
  dark,
}: {
  children: ReactNode;
  active?: boolean;
  dark?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.75 text-xs ${
        dark
          ? "border-lime/35 text-lime"
          : active
            ? "border-line bg-lime text-black"
            : "border-line text-muted"
      }`}
    >
      {children}
    </span>
  );
}

export function BackToWorkLink({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <Link
      href="/#work"
      className={`group inline-flex items-center gap-2 text-sm transition-colors ${
        dark ? "text-soft hover:text-lime" : "text-muted hover:text-ink"
      }`}
    >
      <Image
        src="/back%20arrow%20for%20work.svg"
        alt=""
        width={16}
        height={16}
        className={`transition-transform duration-200 group-hover:-translate-x-1 ${
          dark ? "brightness-0 invert opacity-80" : ""
        }`}
      />
      {label}
    </Link>
  );
}

export function SiteShell({
  children,
  activePage = "home",
  showContactSection = true,
}: {
  children: ReactNode;
  activePage?: SitePage;
  showContactSection?: boolean;
}) {
  return (
    <div id="top" className="builder-portfolio min-h-screen">
      <div className="builder-portfolio-nav">
        <SiteNav activePage={activePage} />
      </div>
      <main>{children}</main>
      <ContactAndFooter showContactSection={showContactSection} />
    </div>
  );
}

export function PillButton({ to, children }: { to: string; children: string }) {
  return <PortfolioActionButton to={to} label={children} />;
}

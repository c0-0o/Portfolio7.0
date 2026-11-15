import type { ReactNode } from "react";
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

export function SiteShell({
  children,
  activePage = "home",
}: {
  children: ReactNode;
  activePage?: SitePage;
}) {
  return (
    <div id="top" className="builder-portfolio min-h-screen">
      <div className="builder-portfolio-nav">
        <SiteNav activePage={activePage} />
      </div>
      <main>{children}</main>
      <ContactAndFooter />
    </div>
  );
}

export function PillButton({ to, children }: { to: string; children: string }) {
  return <PortfolioActionButton to={to} label={children} />;
}

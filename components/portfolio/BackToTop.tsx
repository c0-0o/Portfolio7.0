"use client";

export function BackToTop() {
  return (
    <a
      href="#top"
      className="text-[13px] text-lime md:text-xs"
      onClick={(event) => {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      Back to top ↑
    </a>
  );
}

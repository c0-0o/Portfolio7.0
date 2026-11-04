"use client";

import { MagneticLinesEditor } from "@/lib/magnetic-lines";

export default function EditorPage() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <main
      style={{
        height: "100dvh",
        minHeight: 0,
        boxSizing: "border-box",
        padding: 18,
        background:
          "radial-gradient(circle at top, rgba(91, 143, 255, 0.18), transparent 30%), linear-gradient(180deg, #07090d 0%, #0d1016 100%)",
      }}
    >
      <MagneticLinesEditor />
    </main>
  );
}
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
        background: "#FCFDF8",
      }}
    >
      <MagneticLinesEditor />
    </main>
  );
}
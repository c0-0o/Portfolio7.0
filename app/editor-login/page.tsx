"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function EditorLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/editor-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result: unknown = await response.json();
      const message = result && typeof result === "object" && "error" in result &&
        typeof result.error === "string"
        ? result.error
        : "Could not sign in.";
      if (!response.ok) {
        setError(message);
        return;
      }
      if (!result || typeof result !== "object" || !("redirectTo" in result) || result.redirectTo !== "/editor") {
        setError("The login response was invalid.");
        return;
      }
      router.replace("/editor");
      router.refresh();
    } catch (submitError) {
      console.error("Could not sign in to the editor.", submitError);
      setError("Could not reach the editor. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-[#FCFDF8] px-5 py-10 text-[#141712]">
      <section className="w-full max-w-sm border border-[#dde2d6] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#62695c]">Private workspace</p>
        <h1 className="mt-3 font-display text-3xl">Editor access</h1>
        <p className="mt-3 text-sm leading-6 text-[#62695c]">
          Enter the shared password to open the Magnetic Lines and Cursor Effects editors.
        </p>
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="editor-password">
            Password
            <input
              id="editor-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 rounded border border-[#bcc4b5] bg-white px-3 text-base outline-none focus-visible:border-[#4b741f] focus-visible:ring-2 focus-visible:ring-[#4b741f]/25"
            />
          </label>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 bg-[#adeb66] px-4 font-bold text-[#141712] transition-colors hover:bg-[#9cdb56] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Checking…" : "Open editor"}
          </button>
        </form>
        <Link href="/" className="mt-6 inline-block text-sm underline underline-offset-4">
          Back to portfolio
        </Link>
      </section>
    </main>
  );
}

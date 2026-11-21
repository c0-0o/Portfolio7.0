"use client";

import { useEffect, useRef, useState } from "react";
import {
  isPortfolioSoundEnabled,
  setPortfolioSoundEnabled,
} from "@/lib/audio/portfolioAudio";

export function SoundToggle() {
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const reportError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setError(detail);
    };
    const retryPlayback = (event: Event) => {
      if (
        event.target instanceof Node &&
        buttonRef.current?.contains(event.target)
      ) {
        return;
      }
      if (!isPortfolioSoundEnabled()) {
        removeRetryListeners();
        return;
      }
      void setPortfolioSoundEnabled(true).then((started) => {
        setEnabled(started);
        if (started) {
          setError("");
          removeRetryListeners();
        }
      }).catch((audioError: unknown) => {
        setError(
          audioError instanceof Error
            ? audioError.message
            : "Background audio could not be played.",
        );
        removeRetryListeners();
      });
    };
    const removeRetryListeners = () => {
      document.removeEventListener("pointerdown", retryPlayback, true);
      document.removeEventListener("keydown", retryPlayback, true);
    };
    const addRetryListeners = () => {
      document.addEventListener("pointerdown", retryPlayback, true);
      document.addEventListener("keydown", retryPlayback, true);
    };

    window.addEventListener("portfolio-audio-blocked", addRetryListeners);
    window.addEventListener("portfolio-audio-error", reportError);
    void setPortfolioSoundEnabled(true).then((started) => {
      if (!isPortfolioSoundEnabled()) return;
      setEnabled(started);
      if (!started) addRetryListeners();
    }).catch((audioError: unknown) => {
      setError(
        audioError instanceof Error
          ? audioError.message
          : "Background audio could not be played.",
      );
    });

    return () => {
      removeRetryListeners();
      window.removeEventListener("portfolio-audio-blocked", addRetryListeners);
      window.removeEventListener("portfolio-audio-error", reportError);
    };
  }, []);

  const toggleSound = async () => {
    if (pending) return;
    setPending(true);
    setError("");

    try {
      await setPortfolioSoundEnabled(!enabled);
      setEnabled(!enabled);
    } catch (audioError) {
      setError(
        audioError instanceof Error
          ? audioError.message
          : "Background audio could not be changed.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="portfolio-sound-control">
      {error && (
        <span className="portfolio-sound-error" role="alert">
          {error}
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="portfolio-sound-toggle"
        aria-label={enabled ? "Turn background sound off" : "Turn background sound on"}
        aria-pressed={enabled}
        disabled={pending}
        onClick={toggleSound}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          {enabled ? (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18 6a8.5 8.5 0 0 1 0 12" />
            </>
          ) : (
            <path d="m17 9 5 6m0-6-5 6" />
          )}
        </svg>
      </button>
    </div>
  );
}

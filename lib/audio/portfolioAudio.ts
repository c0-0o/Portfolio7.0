type CatCue = "appear" | "react";

const PORTFOLIO_SOUND_STORAGE_KEY = "portfolio-background-sound";

const MUSIC_TRACKS = [
  "/cinematic-house-take-1.mp3",
  "/Luminous%20Horizons.wav",
  "/Luminous%20Horizons%20%281%29.wav",
  "/Luminous%20Tides.wav",
  "/Luminous%20Tides%20%281%29.wav",
];

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let soundEnabled = true;
let musicAudio: HTMLAudioElement | null = null;
let playlist: string[] = [];
let lastTrack = "";
let musicStartPromise: Promise<boolean> | null = null;

function getAudioGraph() {
  if (audioContext && masterGain) return { context: audioContext, master: masterGain };

  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;

  audioContext = new AudioContextConstructor();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.0001;
  masterGain.connect(audioContext.destination);

  return { context: audioContext, master: masterGain };
}

function ensureMusicAudio() {
  if (musicAudio) return musicAudio;

  musicAudio = new Audio();
  musicAudio.preload = "none";
  musicAudio.volume = 0.08;
  musicAudio.addEventListener("ended", () => {
    if (soundEnabled) {
      void playNextTrack().then((started) => {
        if (!started && soundEnabled) {
          window.dispatchEvent(new Event("portfolio-audio-blocked"));
        }
      }).catch(reportAudioError);
    }
  });
  musicAudio.addEventListener("error", () => {
    reportAudioError(new Error("A background music track could not be loaded."));
  });

  return musicAudio;
}

function refillPlaylist() {
  playlist = [...MUSIC_TRACKS];
  for (let i = playlist.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    [playlist[i], playlist[swapIndex]] = [playlist[swapIndex], playlist[i]];
  }
  if (playlist.length > 1 && playlist[0] === lastTrack) {
    [playlist[0], playlist[1]] = [playlist[1], playlist[0]];
  }
}

function reportAudioError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Background audio could not be played.";
  window.dispatchEvent(new CustomEvent("portfolio-audio-error", { detail: message }));
}

async function playNextTrack() {
  if (!soundEnabled) return false;

  const audio = ensureMusicAudio();
  if (playlist.length === 0) refillPlaylist();
  const track = playlist.shift();
  if (!track) return false;

  lastTrack = track;
  audio.src = track;
  try {
    await audio.play();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      playlist.unshift(track);
      return false;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      playlist.unshift(track);
      return false;
    }
    throw error;
  }
}

async function resumeOrStartMusic() {
  if (musicStartPromise) return musicStartPromise;

  const audio = ensureMusicAudio();
  const start = (async () => {
    if (!audio.src) return playNextTrack();

    try {
      await audio.play();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") return false;
      if (error instanceof DOMException && error.name === "AbortError") return false;
      throw error;
    }
  })();
  musicStartPromise = start;

  try {
    return await start;
  } finally {
    if (musicStartPromise === start) musicStartPromise = null;
  }
}

export async function setPortfolioSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  window.localStorage.setItem(PORTFOLIO_SOUND_STORAGE_KEY, enabled ? "on" : "off");

  if (!enabled) {
    musicAudio?.pause();
    if (audioContext && masterGain) {
      const context = audioContext;
      const master = masterGain;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0.0001, context.currentTime, 0.06);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
      await context.suspend();
    }
    return true;
  }

  const musicStart = resumeOrStartMusic();
  const graph = getAudioGraph();
  if (!graph) return musicStart;
  const { context, master } = graph;
  const contextResume = context.resume().then(
    () => true,
    (error: unknown) => {
      if (error instanceof DOMException && error.name === "NotAllowedError") return false;
      reportAudioError(error);
      return false;
    },
  );
  const [started, contextReady] = await Promise.all([musicStart, contextResume]);
  if (contextReady && context.state === "running") {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0.45, context.currentTime, 0.12);
  }
  return started;
}

export function isPortfolioSoundEnabled() {
  return soundEnabled;
}

export function getInitialPortfolioSoundEnabled() {
  const preference = window.localStorage.getItem(PORTFOLIO_SOUND_STORAGE_KEY);
  if (preference === "off") return false;
  return true;
}

export function playCatCue(cue: CatCue) {
  if (!soundEnabled || !audioContext || !masterGain || audioContext.state !== "running") return;

  const context = audioContext;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const isAppearance = cue === "appear";
  oscillator.type = isAppearance ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(isAppearance ? 620 : 520, now);
  oscillator.frequency.exponentialRampToValueAtTime(isAppearance ? 880 : 360, now + 0.18);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(0.045, now + 0.025);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  oscillator.connect(envelope);
  envelope.connect(masterGain);
  oscillator.start(now);
  oscillator.stop(now + 0.25);
}

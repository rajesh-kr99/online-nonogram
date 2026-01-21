import { useState, useEffect, useRef, useCallback } from "react";

export interface UsePersistentTimerOptions {
  autoStart?: boolean;
}

/**
 * Custom hook that manages a persistent timer with localStorage backing.
 */
export function usePersistentTimer(
  puzzleKey: string,
  options: UsePersistentTimerOptions = {}
) {
  const { autoStart = false } = options;
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(autoStart);
  const initializedRef = useRef(false);

  // Load timer state from localStorage when puzzleKey changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(`nonogram:${puzzleKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.seconds === "number") {
          setSeconds(parsed.seconds);
        }
      } else {
        // No saved data for this key, start fresh
        setSeconds(0);
        setIsRunning(false);
      }
    } catch {
      setSeconds(0);
      setIsRunning(false);
    }

    initializedRef.current = true;
  }, [puzzleKey]);

  // Timer tick: increment seconds every 1000ms when running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        // Save immediately to localStorage
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`nonogram:${puzzleKey}`, JSON.stringify({ seconds: next, isRunning: true }));
          } catch {
            // Ignore
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, puzzleKey]);

  // Save to localStorage on pause/resume
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`nonogram:${puzzleKey}`, JSON.stringify({ seconds, isRunning }));
    } catch {
      // Ignore
    }
  }, [isRunning, puzzleKey]);

  // Control functions
  const play = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`nonogram:${puzzleKey}`);
    } catch {
      // Ignore
    }
    setSeconds(0);
    setIsRunning(false);
    initializedRef.current = false;
  }, [puzzleKey]);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return {
    seconds,
    isRunning,
    display,
    setSeconds,
    setIsRunning,
    play,
    pause,
    resetTimer,
  };
}

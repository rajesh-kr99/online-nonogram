"use client";

import { useEffect, useRef } from "react";
import styles from "./StatsModal.module.css";

type Difficulty = "easy" | "medium" | "hard";

type Stats = {
  totalSolved: number;
  totalSolvedByDifficulty: Record<Difficulty, number>;
  solvedToday: number;
  lastSolvedDateISO: string | null;
  seenTodayByDifficulty?: Record<Difficulty, number>;
};

interface StatsModalProps {
  open: boolean;
  stats: Stats;
  onClose: () => void;
}

export default function StatsModal({ open, stats, onClose }: StatsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastActiveElRef = useRef<HTMLElement | null>(null);

  // Store previously focused element when opening
  useEffect(() => {
    if (!open) return;
    lastActiveElRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  // Restore focus when closing (safely)
  useEffect(() => {
    if (open) return;

    const el = lastActiveElRef.current;
    if (!el) return;

    // Only restore if still in the document and focusable
    if (document.contains(el) && typeof el.focus === "function") {
      el.focus();
    }
  }, [open]);

  // Focus close button on open
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Lock background scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className={styles.closeX}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <h2 id="stats-modal-title" className={styles.title}>
          Stats
        </h2>

        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.label}>Total puzzles solved</span>
            <span className={styles.value}>{stats.totalSolved}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Solved today</span>
            <span className={styles.value}>{stats.solvedToday}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Easy solved</span>
            <span className={styles.value}>{stats.totalSolvedByDifficulty.easy}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Medium solved</span>
            <span className={styles.value}>{stats.totalSolvedByDifficulty.medium}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Hard solved</span>
            <span className={styles.value}>{stats.totalSolvedByDifficulty.hard}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Seen today (Easy)</span>
            <span className={styles.value}>{stats.seenTodayByDifficulty?.easy ?? 0}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Seen today (Medium)</span>
            <span className={styles.value}>{stats.seenTodayByDifficulty?.medium ?? 0}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Seen today (Hard)</span>
            <span className={styles.value}>{stats.seenTodayByDifficulty?.hard ?? 0}</span>
          </div>
        </div>

        <button className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

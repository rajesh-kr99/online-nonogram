"use client";

import styles from "./VictoryModal.module.css";

export interface VictoryModalProps {
  open: boolean;
  puzzleName: string | null;
  time: string;
  difficulty: string;
  onClose: () => void;
  onNextPuzzle: () => void;
}

export default function VictoryModal({
  open,
  puzzleName,
  time,
  difficulty,
  onClose,
  onNextPuzzle,
}: VictoryModalProps) {
  if (!open) return null;

  const handleShare = () => {
    const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    const text = `I solved the Daily Nonogram (${difficultyLabel}) in ${time}! 🧩✨\n\nPlay at: https://online-nonogram.vercel.app`;
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h1 className={styles.title}>🎉 SOLVED! 🎉</h1>

        <div className={styles.revealSection}>
          <p className={styles.subText}>It was a...</p>
          <h2 className={styles.puzzleName}>{puzzleName ? puzzleName.toUpperCase() : "PUZZLE"}</h2>
        </div>

        <div className={styles.statsBox}>
          <p className={styles.statItem}>
            ⏱ Time: <span className={styles.time}>{time}</span>
          </p>
          <p className={styles.statItem}>
            🎯 Difficulty:{" "}
            <span className={styles.time}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>
          </p>
        </div>

        <div className={styles.modalButtons}>
          <button className={styles.btnPrimary} onClick={onNextPuzzle}>
            Continue
          </button>
          <button className={styles.btnSecondary} onClick={handleShare}>
            Share Result
          </button>
        </div>
      </div>
    </div>
  );
}

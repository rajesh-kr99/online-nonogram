"use client";

import styles from "./Timer.module.css";

export interface TimerProps {
  isRunning: boolean;
  seconds: number;
}

export default function Timer({
  seconds,
}: TimerProps) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className={styles.timer}>
      <span className={styles.timerDisplay}>{display}</span>
    </div>
  );
}

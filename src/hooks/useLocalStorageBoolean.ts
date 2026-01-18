"use client";

import { useState, useEffect } from "react";

export function useLocalStorageBoolean(
  key: string,
  defaultValue: boolean
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false);

  // Read from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(stored === "true");
      }
    } catch {
      // localStorage not available
    }
    setIsInitialized(true);
  }, [key]);

  // Write to localStorage when value changes (after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // localStorage not available
    }
  }, [key, value, isInitialized]);

  return [value, setValue];
}

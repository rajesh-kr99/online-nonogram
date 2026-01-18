import styles from "./AdSlot.module.css";

interface AdSlotProps {
  /** Display variant determining the ad size */
  variant: "desktop" | "mobile";
  /** Whether to render the ad slot (false = renders nothing) */
  show: boolean;
  /** Unique ad unit identifier for ad network integration */
  slotId: string;
}

/**
 * AdSlot Component
 *
 * Renders a fixed-dimension container for advertisements.
 * - Desktop: exactly 300×600 pixels
 * - Mobile: exactly 320×50 pixels
 *
 * Constraints enforced:
 * - Dimensions cannot collapse to 0 (min/max width/height locked)
 * - No sticky or fixed positioning
 * - No animations
 * - No external scripts loaded by this component
 *
 * Future Ad Network Integration:
 * 1. Import the ad network's React component or use useEffect for script mounting
 * 2. Replace the placeholder content with the ad component
 * 3. Use the slotId prop to configure the ad unit
 */
export default function AdSlot({ variant, show, slotId }: AdSlotProps) {
  // When show=false, render nothing (slot disappears completely)
  if (!show) {
    return null;
  }

  const isDesktop = variant === "desktop";
  const dimensions = isDesktop ? "300×600" : "320×50";

  return (
    <div
      className={`${styles.adSlot} ${isDesktop ? styles.desktop : styles.mobile}`}
      role="complementary"
      aria-label={`Advertisement ${dimensions}`}
      data-ad-slot={slotId}
    >
      {/*
        PLACEHOLDER CONTENT
        Replace with ad network component when integrating.
        The container's fixed dimensions prevent layout shift.
      */}
      <div className={styles.placeholderContent}>
        <span className={styles.label}>Ad {dimensions}</span>
        <span className={styles.slotIdCaption}>{slotId}</span>
      </div>
    </div>
  );
}

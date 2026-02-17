"use client";

import { Birdhouse, Grid3X3, Proportions } from "lucide-react";
import { useState } from "react";

import { NavMenu } from "../NavMenu";

import { HandDrawnGrid } from "./HandDrawnGrid";
import styles from "./dimensions.module.css";

export default function DimensionsPage() {
  const [view, setView] = useState<"dimensions" | "grid">("dimensions");

  const toggleView = () =>
    setView((v) => (v === "dimensions" ? "grid" : "dimensions"));

  return (
    <div className={view === "grid" ? styles.gridPage : styles.page}>
      <NavMenu
        hideMenu={view === "grid"}
        onPageIconClick={toggleView}
        pageIcon={view === "dimensions" ? Proportions : Grid3X3}
      />
      {view === "grid" && <HandDrawnGrid />}
      <h1 className={styles.title}>Dimensions</h1>
      <div className={styles.minBox}>
        <svg className={styles.cardGrid} height="100%" width="100%">
          <line x1="16" x2="16" y1="0" y2="100%" />
          <line x1="64" x2="64" y1="0" y2="100%" />
          <line x1="112" x2="112" y1="0" y2="100%" />
          <line x1="160" x2="160" y1="0" y2="100%" />
          <line x1="208" x2="208" y1="0" y2="100%" />
          <line x1="256" x2="256" y1="0" y2="100%" />
          <line x1="272" x2="272" y1="0" y2="100%" />
          <line x1="0" x2="100%" y1="16" y2="16" />
          <line x1="0" x2="100%" y1="64" y2="64" />
          <line x1="0" x2="100%" y1="80" y2="80" />
        </svg>
      </div>
      <p className={styles.rule}>
        The minimum available width is always at least 240 across by 48 high
        with a 16 pixel margin, for a total of 272.
      </p>
      <p className={styles.rule}>
        The minimum double-width screen must be at least 576. The maximum
        content width is 544. The maximum double-width screen would be 1152.
      </p>
      <p className={styles.rule}>
        At narrow widths, the headings should go under the nav widget. 288
        (minimum) to 576. From 576 to 704 the content area should slide right,
        at 704 it should snap up.
      </p>
      <div className={styles.wideSquare}>
        <svg className={styles.cardGrid} height="100%" width="100%">
          <line x1="16" x2="16" y1="0" y2="100%" />
          <line x1="64" x2="64" y1="0" y2="100%" />
          <line x1="112" x2="112" y1="0" y2="100%" />
          <line x1="160" x2="160" y1="0" y2="100%" />
          <line x1="208" x2="208" y1="0" y2="100%" />
          <line x1="256" x2="256" y1="0" y2="100%" />
          <line x1="272" x2="272" y1="0" y2="100%" />
          <line x1="288" x2="288" y1="0" y2="100%" />
          <line x1="336" x2="336" y1="0" y2="100%" />
          <line x1="384" x2="384" y1="0" y2="100%" />
          <line x1="432" x2="432" y1="0" y2="100%" />
          <line x1="480" x2="480" y1="0" y2="100%" />
          <line x1="528" x2="528" y1="0" y2="100%" />
          <line x1="544" x2="544" y1="0" y2="100%" />
          <line x1="0" x2="100%" y1="16" y2="16" />
          <line x1="0" x2="100%" y1="64" y2="64" />
          <line x1="0" x2="100%" y1="112" y2="112" />
          <line x1="0" x2="100%" y1="160" y2="160" />
          <line x1="0" x2="100%" y1="208" y2="208" />
          <line x1="0" x2="100%" y1="256" y2="256" />
          <line x1="0" x2="100%" y1="272" y2="272" />
        </svg>
      </div>
      <div className={styles.card}>
        <svg className={styles.cardGrid} height="100%" width="100%">
          <line x1="16" x2="16" y1="0" y2="100%" />
          <line x1="64" x2="64" y1="0" y2="100%" />
          <line x1="256" x2="256" y1="0" y2="100%" />
          <line x1="272" x2="272" y1="0" y2="100%" />
          <line x1="100%" x2="100%" y1="0" y2="100%" style={{ transform: "translateX(-16px)" }} />
          <line x1="0" x2="100%" y1="16" y2="16" />
          <line x1="0" x2="100%" y1="64" y2="64" />
          <line x1="0" x2="100%" y1="72" y2="72" />
          <line x1="0" x2="100%" y1="120" y2="120" />
          <line x1="0" x2="100%" y1="128" y2="128" />
          <line x1="0" x2="100%" y1="100%" y2="100%" style={{ transform: "translateY(-16px)" }} />
        </svg>
        <div className={styles.cardContent}>
          <div className={styles.boxRow}>
            <div className={styles.iconBox}>
              <Birdhouse size={24} strokeWidth={1} />
            </div>
            <div className={styles.labelBox}>Home</div>
          </div>
        </div>
      </div>
    </div>
  );
}

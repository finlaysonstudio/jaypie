"use client";

import { Grid3X3, Proportions } from "lucide-react";
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
      <p className={styles.rule}>Minimum supported width: 272</p>
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
      <p className={styles.rule}>Absolute minimum width: 176</p>
      <div className={styles.absMinBox}>
        <svg className={styles.cardGrid} height="100%" width="100%">
          <line x1="16" x2="16" y1="0" y2="100%" />
          <line x1="64" x2="64" y1="0" y2="100%" />
          <line x1="112" x2="112" y1="0" y2="100%" />
          <line x1="160" x2="160" y1="0" y2="100%" />
          <line x1="176" x2="176" y1="0" y2="100%" />
          <line x1="0" x2="100%" y1="16" y2="16" />
          <line x1="0" x2="100%" y1="64" y2="64" />
          <line x1="0" x2="100%" y1="80" y2="80" />
        </svg>
      </div>
      <p className={styles.rule}>Maximum content width: 544 (with padding), 512 (without)</p>
      <p className={styles.rule}>sm: 544</p>
      <div className={styles.splitBox}>
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
          <line x1="0" x2="100%" y1="80" y2="80" />
        </svg>
      </div>
      <p className={styles.lorem}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
        velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
        occaecat cupidatat non proident, sunt in culpa qui officia deserunt
        mollit anim id est laborum.
      </p>
    </div>
  );
}

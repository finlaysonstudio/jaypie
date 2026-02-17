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

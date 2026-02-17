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
    </div>
  );
}

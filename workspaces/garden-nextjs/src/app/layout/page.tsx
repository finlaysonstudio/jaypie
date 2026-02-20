"use client";

import { RulerDimensionLine } from "lucide-react";

import { NavMenu } from "../NavMenu";
import styles from "../dimensions/dimensions.module.css";

export default function LayoutPage() {
  return (
    <div className={styles.page}>
      <NavMenu pageIcon={RulerDimensionLine} />
      <h1 className={styles.title}>Layout</h1>
    </div>
  );
}

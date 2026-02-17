"use client";

import { Proportions } from "lucide-react";

import { NavMenu } from "../NavMenu";

import styles from "./dimensions.module.css";

export default function DimensionsPage() {
  return (
    <div className={styles.page}>
      <NavMenu pageIcon={Proportions} />
      <h1 className={styles.title}>Dimensions</h1>
    </div>
  );
}

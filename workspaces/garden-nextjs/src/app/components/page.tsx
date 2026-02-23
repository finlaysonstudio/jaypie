"use client";

import { Component } from "lucide-react";

import { NavMenu } from "../NavMenu";
import styles from "../dimensions/dimensions.module.css";

export default function ComponentsPage() {
  return (
    <div className={styles.page}>
      <NavMenu pageIcon={Component} />
      <h1 className={styles.title}>Components</h1>
    </div>
  );
}

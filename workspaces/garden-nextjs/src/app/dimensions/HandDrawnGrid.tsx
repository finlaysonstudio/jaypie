"use client";

import { useEffect, useMemo, useState } from "react";

import styles from "./dimensions.module.css";

// Fixed grid positions (cumulative)
const X_POSITIONS = [16, 64, 112, 128, 256, 272, 288, 528, 544, 640, 656];
const Y_POSITIONS = [16, 64, 80];

export function HandDrawnGrid() {
  const [size, setSize] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const update = () =>
      setSize({ height: window.innerHeight, width: window.innerWidth });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const paths = useMemo(() => {
    if (!size.width || !size.height) return [];

    const lines: { d: string; key: string }[] = [];

    for (const x of X_POSITIONS) {
      lines.push({ d: `M ${x} 0 L ${x} ${size.height}`, key: `vl${x}` });
    }

    for (const y of Y_POSITIONS) {
      lines.push({ d: `M 0 ${y} L ${size.width} ${y}`, key: `h${y}` });
    }

    return lines;
  }, [size.height, size.width]);

  if (!size.width) return null;

  return (
    <svg className={styles.grid} height={size.height} width={size.width}>
      {paths.map(({ d, key }) => (
        <path d={d} key={key} />
      ))}
    </svg>
  );
}

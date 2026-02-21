"use client";

import { Copy, CopyCheck, SwatchBook } from "lucide-react";
import { useState } from "react";

import { colors, type ColorShades } from "../../lib/colors";
import { NavMenu } from "../NavMenu";

import styles from "./colors.module.css";

//
//
// Helpers
//

const SHADE_KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

function getShadeName(colorName: string, idx: number): string {
  if (idx === 5) return colorName;
  return `${colorName}-${SHADE_KEYS[idx]}`;
}

function isLightColor(hex: string): boolean {
  return (
    hex.startsWith("#f") ||
    hex.startsWith("#e") ||
    hex.startsWith("#d") ||
    hex.startsWith("#c") ||
    hex.startsWith("#b")
  );
}

function flattenShades(shades: ColorShades): string[] {
  return SHADE_KEYS.map((key) => shades[key]);
}

//
//
// Components
//

function CopyText({
  copyValue,
  display,
  style,
}: {
  copyValue: string;
  display: string;
  style?: React.CSSProperties;
}) {
  const [copying, setCopying] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyValue);
    setCopying(true);
    setCooldown(true);
    setTimeout(() => {
      setCopying(false);
    }, 500);
  };

  const handleMouseLeave = () => {
    setCooldown(false);
  };

  const buttonClass = [
    styles.copyButton,
    copying ? styles.copyButtonFlash : "",
    cooldown && !copying ? styles.copyButtonCooldown : "",
  ]
    .filter(Boolean)
    .join(" ");

  const iconClass = copying ? styles.copyIconActive : styles.copyIcon;

  return (
    <button
      className={buttonClass}
      onClick={handleCopy}
      onMouseLeave={handleMouseLeave}
      style={style}
    >
      <span>{display}</span>
      {copying ? (
        <CopyCheck className={iconClass} size={12} strokeWidth={1} />
      ) : (
        <Copy className={iconClass} size={12} strokeWidth={1} />
      )}
    </button>
  );
}

function ColorCard({ name, shades }: { name: string; shades: string[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [lockedIdx, setLockedIdx] = useState(5);

  const activeIdx = hoveredIdx !== null ? hoveredIdx : lockedIdx;
  const activeShade = shades[activeIdx];
  const activeName = getShadeName(name, activeIdx);

  const light = isLightColor(activeShade);
  const textColor = light ? "#282726" : "#fafafa";
  const mutedColor = light
    ? "rgba(40, 39, 38, 0.6)"
    : "rgba(250, 250, 250, 0.7)";

  return (
    <div className={styles.card} style={{ backgroundColor: activeShade }}>
      <div className={styles.cardInfo}>
        <div className={styles.shadeName}>
          <CopyText
            copyValue={activeName}
            display={activeName}
            style={{ color: textColor }}
          />
        </div>
        <div className={styles.hexCode}>
          <CopyText
            copyValue={activeShade.slice(1)}
            display={activeShade}
            style={{ color: mutedColor }}
          />
        </div>
      </div>
      <div className={styles.shadeStrip}>
        {shades.map((shade, idx) => (
          <button
            className={styles.shadeButton}
            key={idx}
            onClick={() => setLockedIdx(idx)}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{ backgroundColor: shade }}
            title={`${getShadeName(name, idx)}: ${shade}`}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

//
//
// Page
//

// Cool → warm → brown spectrum
const COLOR_ORDER = [
  "mist", "slate", "gray", "ink", "zinc", "brown",
  "orange", "amber", "yellow", "lime",
  "green", "emerald", "teal", "cyan",
  "sky", "blue", "indigo", "violet",
  "purple", "fuchsia", "pink", "rose", "red",
];

const COLOR_DATA = COLOR_ORDER.map((name) => ({
  name,
  shades: flattenShades(colors[name as keyof typeof colors]),
}));

export default function ColorsPage() {
  return (
    <div className={styles.page}>
      <NavMenu pageIcon={SwatchBook} />
      <h1 className={styles.title}>Colors</h1>
      <div className={styles.usageCard}>
        <h2 className={styles.usageHeading}>Backgrounds</h2>
        <div className={styles.usageSwatchRow}>
          <div
            className={styles.usageSwatch}
            style={{ backgroundColor: "#282726" }}
          />
          <div className={styles.usageSwatchInfo}>
            <CopyText
              copyValue="--bg-primary"
              display="--bg-primary"
              style={{ color: "#fafafa" }}
            />
            <CopyText
              copyValue="282726"
              display="#282726"
              style={{ color: "#fafafa", fontSize: "12px" }}
            />
          </div>
        </div>
        <h2 className={styles.usageHeading}>Foregrounds</h2>
        <h2 className={styles.usageHeading}>Borders and Shadows</h2>
      </div>
      <div className={styles.grid}>
        {COLOR_DATA.map((color) => (
          <ColorCard
            key={color.name}
            name={color.name}
            shades={color.shades}
          />
        ))}
      </div>
    </div>
  );
}

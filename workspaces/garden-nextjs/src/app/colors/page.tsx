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

// Usage card data
const USAGE_SECTIONS: { heading: string; swatches: { color: string; name: string; value: string }[] }[] = [
  {
    heading: "Backgrounds",
    swatches: [
      { color: "#282726", name: "--bg-primary", value: "#282726" },
      { color: "#161514", name: "--bg-secondary", value: "#161514" },
      { color: "#f8f6f5", name: "--bg-light", value: "#f8f6f5" },
    ],
  },
  {
    heading: "Foregrounds",
    swatches: [
      { color: "#cccbca", name: "--text-primary", value: "#cccbca" },
      { color: "#6c6b6a", name: "--text-muted", value: "#6c6b6a" },
      { color: "#7a6652", name: "--accent-bronze", value: "#7a6652" },
      { color: "#635242", name: "--accent-bronze-hover", value: "#635242" },
    ],
  },
  {
    heading: "Borders and Shadows",
    swatches: [
      { color: "rgba(207, 203, 199, 0.1)", name: "--border-color", value: "rgba(207, 203, 199, 0.1)" },
    ],
  },
  {
    heading: "Statuses",
    swatches: [
      { color: "#1b2f22", name: "authenticated-bg", value: "#1b2f22" },
      { color: "#8fb69a", name: "authenticated-text", value: "#8fb69a" },
      { color: "#3b3418", name: "connected-bg", value: "#3b3418" },
      { color: "#cfc07e", name: "connected-text", value: "#cfc07e" },
      { color: "#3d211d", name: "disconnected-bg", value: "#3d211d" },
      { color: "#c9a099", name: "disconnected-text", value: "#c9a099" },
      { color: "#8b5533", name: "uninitialized-bg", value: "#8b5533" },
      { color: "#f9ede2", name: "uninitialized-text", value: "#f9ede2" },
      { color: "#3a2129", name: "unknown-bg", value: "#3a2129" },
      { color: "#c49aab", name: "unknown-text", value: "#c49aab" },
    ],
  },
  {
    heading: "Navigation",
    swatches: [
      { color: "rgba(0, 0, 0, 0.7)", name: "menu-backdrop", value: "rgba(0, 0, 0, 0.7)" },
      { color: "rgba(0, 0, 0, 0.85)", name: "modal-backdrop", value: "rgba(0, 0, 0, 0.85)" },
      { color: "rgba(207, 203, 199, 0.5)", name: "nav-text", value: "rgba(207, 203, 199, 0.5)" },
      { color: "rgba(207, 203, 199, 0.4)", name: "search-icon", value: "rgba(207, 203, 199, 0.4)" },
      { color: "rgba(122, 102, 82, 0.1)", name: "nav-hover", value: "rgba(122, 102, 82, 0.1)" },
      { color: "rgba(122, 102, 82, 0.05)", name: "icon-bg", value: "rgba(122, 102, 82, 0.05)" },
    ],
  },
];

function UsageSwatch({ color, name, value }: { color: string; name: string; value: string }) {
  const isVariable = name.startsWith("--");
  return (
    <div className={styles.usageSwatchRow}>
      <div className={styles.usageSwatch} style={{ backgroundColor: color }} />
      <div className={styles.usageSwatchInfo}>
        {isVariable ? (
          <CopyText copyValue={name} display={name} style={{ color: "#fafafa" }} />
        ) : (
          <span className={styles.usageSwatchLabel}>{name}</span>
        )}
        <CopyText
          copyValue={value.replace("#", "")}
          display={value}
          style={{ color: "#fafafa", fontSize: "12px" }}
        />
      </div>
    </div>
  );
}

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
        {USAGE_SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2 className={styles.usageHeading}>{section.heading}</h2>
            {section.swatches.map((swatch) => (
              <UsageSwatch key={swatch.name} {...swatch} />
            ))}
          </div>
        ))}
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

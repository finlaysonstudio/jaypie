"use client";

import { Copy, CopyCheck, Menu, SwatchBook } from "lucide-react";
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function blendColor(base: string, fore: string, alpha: string): string {
  const a = parseInt(alpha || "0", 16) / 255;
  const [br, bg, bb] = hexToRgb(base);
  const [fr, fg, fb] = hexToRgb(fore);
  const r = Math.round(fr * a + br * (1 - a));
  const g = Math.round(fg * a + bg * (1 - a));
  const b = Math.round(fb * a + bb * (1 - a));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function ColorMixer() {
  const [base, setBase] = useState("282726");
  const [fore, setFore] = useState("9a9896");
  const [alpha, setAlpha] = useState("a5");

  const result = blendColor(base, fore, alpha);
  const alphaNum = parseInt(alpha || "0", 16) / 255;

  return (
    <div className={styles.mixerCard}>
      <div className={styles.mixerLayout}>
        <div
          className={styles.mixerSwatch}
          style={{ backgroundColor: `#${base}` }}
        >
          <div
            className={styles.mixerSwatchInner}
            style={{ backgroundColor: `#${fore}` }}
          />
        </div>
        <div className={styles.mixerControls}>
          <div className={styles.mixerField}>
            <span className={styles.mixerLabel}>base</span>
            <input
              className={styles.mixerInput}
              maxLength={6}
              onChange={(e) => setBase(e.target.value)}
              type="text"
              value={base}
            />
          </div>
          <div className={styles.mixerField}>
            <span className={styles.mixerLabel}>fore</span>
            <input
              className={styles.mixerInput}
              maxLength={6}
              onChange={(e) => setFore(e.target.value)}
              type="text"
              value={fore}
            />
          </div>
          <div className={styles.mixerField}>
            <span className={styles.mixerLabel}>alpha</span>
            <input
              className={styles.mixerInput}
              maxLength={2}
              onChange={(e) => setAlpha(e.target.value)}
              style={{ width: 40 }}
              type="text"
              value={alpha}
            />
          </div>
        </div>
      </div>
      <div className={styles.mixerResultRow}>
        <div
          className={styles.mixerSwatch}
          style={{ backgroundColor: `#${base}` }}
        >
          <div
            className={styles.mixerSwatchInner}
            style={{
              backgroundColor: `#${fore.padEnd(6, "0").slice(0, 6)}${alpha.padStart(2, "0")}`,
            }}
          />
        </div>
        <div className={styles.mixerResult}>
          <CopyText
            copyValue={result.slice(1)}
            display={result}
            style={{ color: "#fafafa" }}
          />
        </div>
      </div>
    </div>
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
    ? "#28272699"
    : "#fafafab2";

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

// Alpha swatches
const ALPHA_SWATCHES: { color: string; name: string; value: string }[] = [
  { color: "#cfcbc71a", name: "--border-color", value: "#cfcbc71a cfcbc7 @10%" },
  { color: "#000000b2", name: "menu-backdrop", value: "#000000b2 black @70%" },
  { color: "#000000d8", name: "modal-backdrop", value: "#000000d8 black @85%" },
  { color: "#cfcbc780", name: "nav-text", value: "#cfcbc780 cfcbc7 @50%" },
  { color: "#cfcbc766", name: "search-icon", value: "#cfcbc766 cfcbc7 @40%" },
  { color: "#7a66521a", name: "nav-hover", value: "#7a66521a brown-500 @10%" },
  { color: "#7a66520d", name: "icon-bg", value: "#7a66520d brown-500 @5%" },
];

// Background sections
const BACKGROUND_SECTIONS: { heading: string; swatches: { color: string; name: string; value: string }[] }[] = [
  {
    heading: "Primary",
    swatches: [
      { color: "#282726", name: "--bg-primary", value: "#282726 zinc-800" },
      { color: "#403d3b", name: "--bg-surface", value: "#403d3b zinc-700" },
      { color: "#161514", name: "--bg-subsurface", value: "#161514 zinc-900" },
    ],
  },
  {
    heading: "Secondary",
    swatches: [
      { color: "#2d2a28", name: "--bg-secondary", value: "#2d2a28" },
      { color: "#302c29", name: "--bg-secondary-surface", value: "#302c29" },
      { color: "#171615", name: "--bg-secondary-subsurface", value: "#171615" },
    ],
  },
  {
    heading: "Alt",
    swatches: [
      { color: "#2a2428", name: "--bg-alt", value: "#2a2428 ink-800" },
      { color: "#413940", name: "--bg-alt-surface", value: "#413940 ink-700" },
      { color: "#161013", name: "--bg-alt-subsurface", value: "#161013 ink-900" },
    ],
  },
];

// Foreground sections
const FOREGROUND_SECTIONS: { heading: string; swatches: { color: string; name: string; value: string }[] }[] = [
  {
    heading: "Primary",
    swatches: [
      { color: "#edebea", name: "--text-focus", value: "#edebea" },
      { color: "#d8d5d3", name: "--text-primary", value: "#d8d5d3" },
      { color: "#9a9896", name: "--text-muted", value: "#9a9896" },
      { color: "#6b6968", name: "--text-subtle", value: "#6b6968" },
    ],
  },
  {
    heading: "Secondary",
    swatches: [
      { color: "#ddd3c9", name: "--text-secondary-focus", value: "#ddd3c9" },
      { color: "#c4b5a6", name: "--text-secondary-primary", value: "#c4b5a6" },
      { color: "#8d8379", name: "--text-secondary-muted", value: "#8d8379" },
      { color: "#635d57", name: "--text-secondary-subtle", value: "#635d57" },
    ],
  },
  {
    heading: "Alt",
    swatches: [
      { color: "#e5e9ee", name: "--text-alt-focus", value: "#e5e9ee" },
      { color: "#d5dbe2", name: "--text-alt-primary", value: "#d5dbe2" },
      { color: "#989ba0", name: "--text-alt-muted", value: "#989ba0" },
      { color: "#6a6b6e", name: "--text-alt-subtle", value: "#6a6b6e" },
    ],
  },
];

// Usage card data
const USAGE_SECTIONS: { heading: string; swatches: { color: string; name: string; value: string }[] }[] = [
  {
    heading: "Backgrounds",
    swatches: [
      { color: "#282726", name: "--bg-primary", value: "#282726" },
      { color: "#2d2a28", name: "--bg-secondary", value: "#2d2a28" },
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
];

function UsageSwatch({ color, name, value }: { color: string; name: string; value: string }) {
  const isVariable = name.startsWith("--");
  const spaceIdx = value.indexOf(" ");
  const hexPart = spaceIdx === -1 ? value : value.slice(0, spaceIdx);
  const annotation = spaceIdx === -1 ? "" : value.slice(spaceIdx);
  return (
    <div className={styles.usageSwatchRow}>
      <div className={styles.usageSwatch} style={{ backgroundColor: color }} />
      <div className={styles.usageSwatchInfo}>
        {isVariable ? (
          <CopyText copyValue={name} display={name} style={{ color: "#fafafa" }} />
        ) : (
          <span className={styles.usageSwatchLabel}>{name}</span>
        )}
        <span className={styles.usageSwatchValueRow}>
          <CopyText
            copyValue={hexPart.replace("#", "")}
            display={hexPart}
            style={{ color: "#fafafa", fontSize: "12px" }}
          />
          {annotation && <span className={styles.usageSwatchAnnotation}>{annotation}</span>}
        </span>
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
      <h2 className={styles.cardLabel}>Color Mixer</h2>
      <ColorMixer />
      <h2 className={styles.cardLabel}>Backgrounds</h2>
      <div className={styles.usageCard}>
        {BACKGROUND_SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2 className={styles.usageHeading}>{section.heading}</h2>
            {section.swatches.map((swatch) => (
              <UsageSwatch key={swatch.name} {...swatch} />
            ))}
          </div>
        ))}
      </div>
      <h2 className={styles.cardLabel}>Foregrounds</h2>
      <div className={styles.usageCard}>
        {FOREGROUND_SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2 className={styles.usageHeading}>{section.heading}</h2>
            {section.swatches.map((swatch) => (
              <UsageSwatch key={swatch.name} {...swatch} />
            ))}
          </div>
        ))}
      </div>
      <h2 className={styles.cardLabel}>Navigation</h2>
      <div className={styles.navCard}>
        <div className={`${styles.navCardSection} ${styles.navCardSectionTop}`}>
          <div className={styles.navCardSubheading}>Active</div>
          <UsageSwatch color="#7a66520d" name="icon-bg" value="#7a66520d brown-500 @5%" />
          <UsageSwatch color="#cfcbc780" name="icon-fg" value="#cfcbc780 @50%" />
          <div className={styles.navCardSubheading}>Hover</div>
          <UsageSwatch color="#7a66521a" name="icon-bg-hover" value="#7a66521a brown-500 @10%" />
          <UsageSwatch color="#cccbca" name="icon-fg-hover" value="var(--text-primary)" />
          <div className={styles.navIconSwatchRow}>
            <div className={styles.navIconBox}>
              <Menu size={20} strokeWidth={1} />
            </div>
            <div className={styles.usageSwatchInfo}>
              <span className={styles.usageSwatchLabel}>active</span>
              <span>stroke: 1</span>
            </div>
          </div>
          <div className={styles.navIconSwatchRow}>
            <div className={styles.navIconBox} data-hover="true">
              <Menu size={20} strokeWidth={1.5} />
            </div>
            <div className={styles.usageSwatchInfo}>
              <span className={styles.usageSwatchLabel}>hover</span>
              <span>stroke: 1.5</span>
            </div>
          </div>
        </div>
        <div className={`${styles.navCardSection} ${styles.navCardSectionBottom}`}>
          <UsageSwatch color="#7a6652" name="--accent-bronze" value="#7a6652" />
        </div>
      </div>
      <h2 className={styles.cardLabel}>Originals</h2>
      <div className={styles.usageCard}>
        {USAGE_SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2 className={styles.usageHeading}>{section.heading}</h2>
            {section.swatches.map((swatch) => (
              <UsageSwatch key={swatch.name} {...swatch} />
            ))}
          </div>
        ))}
        <h2 className={styles.usageHeading}>Alphas</h2>
        {ALPHA_SWATCHES.map((swatch) => (
          <UsageSwatch key={swatch.name} {...swatch} />
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

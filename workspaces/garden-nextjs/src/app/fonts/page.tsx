import { NavMenu } from "../NavMenu";

import styles from "./fonts.module.css";

const FONTS = [
  {
    aliases: ["--font-heading"],
    description:
      "Display serif for the brand voice. Used for page titles, hero text, and anywhere the brand identity needs to be felt.",
    family: "Faculty Glyphic",
    sample: "Jaypie Garden",
    variable: "--font-brand",
  },
  {
    aliases: [],
    description:
      "Body serif for long-form reading. Default font for the document. Warm and legible at small sizes.",
    family: "Noto Serif",
    sample:
      "The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    variable: "--font-body",
  },
  {
    aliases: [],
    description:
      "Sans-serif for user-generated content. Neutral and clean, distinguishes user input from editorial text.",
    family: "Noto Sans",
    sample: "User input, form fields, chat messages",
    variable: "--font-user",
  },
  {
    aliases: ["--font-ui", "--font-footer"],
    description:
      "System sans-serif for interface chrome. Navigation, buttons, labels, metadata, and footers.",
    family: "Inter",
    sample: "Menu items, buttons, status labels",
    variable: "--font-system",
  },
  {
    aliases: [],
    description:
      "Monospace for code, data, and technical values. API keys, hex codes, and inline code.",
    family: "Noto Sans Mono",
    sample: "sk_jpi_abc123 #282726 console.log()",
    variable: "--font-code",
  },
];

export default function FontsPage() {
  return (
    <div className={styles.page}>
      <NavMenu />
      <h1 className={styles.title}>Fonts</h1>
      <div className={styles.fontList}>
        {FONTS.map(({ aliases, description, family, sample, variable }) => (
          <div className={styles.fontCard} key={variable}>
            <p className={styles.fontSample} style={{ fontFamily: family }}>
              {sample}
            </p>
            <div className={styles.fontMeta}>
              <span className={styles.fontFamily}>{family}</span>
              <span className={styles.fontVariable}>{variable}</span>
              {aliases.length > 0 && (
                <span className={styles.fontAliases}>
                  {aliases.join(", ")}
                </span>
              )}
            </div>
            <p className={styles.fontDescription}>{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

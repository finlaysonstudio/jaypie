"use client";

import { BookType } from "lucide-react";

import { NavMenu } from "../NavMenu";

import styles from "./fonts.module.css";

export default function FontsPage() {
  return (
    <div className={styles.page}>
      <NavMenu pageIcon={BookType} />
      <h1 className={styles.title}>Fonts</h1>

      {/* Faculty Glyphic */}
      <section className={styles.specimen}>
        <p className={styles.brandHero}>Faculty Glyphic</p>
        <p className={styles.brandAlphabet}>
          ABCDEFGHIJKLMNOPQRSTUVWXYZ
          <br />
          abcdefghijklmnopqrstuvwxyz
          <br />
          0123456789
        </p>
        <div className={styles.meta}>
          <span className={styles.variable}>--font-brand</span>
          <span className={styles.alias}>--font-heading</span>
        </div>
        <p className={styles.description}>
          The brand voice. Page titles, hero text, and anywhere the identity
          needs to land. A glyphic serif with sharp geometry that reads as
          modern but grounded.
        </p>
      </section>

      {/* Noto Serif */}
      <section className={styles.specimen}>
        <p className={styles.bodyLede}>
          Noto Serif is the default typeface. It carries the long-form reading
          experience — warm, steady, and legible down to small sizes.
        </p>
        <p className={styles.bodyParagraph}>
          Every paragraph on the page, every explanation, every piece of
          editorial content runs through this font. It pairs naturally with
          Faculty Glyphic above it and stays out of the way below. The slight
          warmth in the letterforms keeps walls of text from feeling clinical.
        </p>
        <div className={styles.meta}>
          <span className={styles.variable}>--font-body</span>
        </div>
      </section>

      {/* Noto Sans */}
      <section className={styles.specimen}>
        <div className={styles.userContext}>
          <p className={styles.userMessage}>
            This is what user-generated content looks like. Chat messages, form
            inputs, anything typed by a person rather than written by the
            system.
          </p>
          <p className={styles.userCaption}>
            Sans-serif signals &ldquo;this came from a user&rdquo; — a
            deliberate visual break from the editorial serif.
          </p>
        </div>
        <div className={styles.meta}>
          <span className={styles.variable}>--font-user</span>
          <span className={styles.familyName}>Noto Sans</span>
        </div>
      </section>

      {/* Inter */}
      <section className={styles.specimen}>
        <div className={styles.uiSamples}>
          <div className={styles.uiChip}>Status</div>
          <div className={styles.uiChip}>Authenticate</div>
          <div className={styles.uiChip}>Search</div>
          <div className={styles.uiChip}>Settings</div>
        </div>
        <p className={styles.uiLabel}>
          THE INTERFACE FONT. NAVIGATION, BUTTONS, LABELS, METADATA.
        </p>
        <div className={styles.meta}>
          <span className={styles.variable}>--font-system</span>
          <span className={styles.alias}>--font-ui</span>
          <span className={styles.alias}>--font-footer</span>
          <span className={styles.familyName}>Inter</span>
        </div>
        <p className={styles.description}>
          Optimized for screen rendering at small sizes. It disappears into
          the interface — you read the label, not the letterform.
        </p>
      </section>

      {/* Noto Sans Mono */}
      <section className={styles.specimen}>
        <div className={styles.codeBlock}>
          <span className={styles.codeMuted}>const</span> color ={" "}
          <span className={styles.codeValue}>&quot;#282726&quot;</span>;
          <br />
          <span className={styles.codeMuted}>const</span> key ={" "}
          <span className={styles.codeValue}>
            &quot;sk_jpi_9f3a&quot;
          </span>;
          <br />
          console.log(color, key);
        </div>
        <div className={styles.meta}>
          <span className={styles.variable}>--font-code</span>
          <span className={styles.familyName}>Noto Sans Mono</span>
        </div>
        <p className={styles.description}>
          Code, data, and technical values. Fixed-width so characters align
          and hex codes scan. Used for anything that would appear in a
          terminal.
        </p>
      </section>
    </div>
  );
}

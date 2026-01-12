import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

function Hero(): React.ReactElement {
  return (
    <section className={styles.hero}>
      <div className={styles.heroBackground}>
        <div className={styles.heroOrb1} />
        <div className={styles.heroOrb2} />
      </div>
      <div className={styles.heroContent}>
        <p className={styles.heroEyebrow}>Event-Driven TypeScript</p>
        <h1 className={styles.heroTitle}>Jaypie</h1>
        <p className={styles.heroSubtitle}>
          A complete stack approach to multi-environment cloud applications.
          Lifecycle management, secrets, queues, and infrastructure—unified.
        </p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} to="/docs/intro">
            Get Started
          </Link>
          <Link className={styles.secondaryButton} to="/docs/api/kit">
            Explore API
          </Link>
        </div>
      </div>
    </section>
  );
}

interface CapabilityProps {
  description: string;
  title: string;
}

function Capability({ description, title }: CapabilityProps): React.ReactElement {
  return (
    <div className={styles.capability}>
      <h3 className={styles.capabilityTitle}>{title}</h3>
      <p className={styles.capabilityDescription}>{description}</p>
    </div>
  );
}

function Capabilities(): React.ReactElement {
  const capabilities: CapabilityProps[] = [
    {
      description:
        "Single handler function manages validate, setup, execute, and teardown phases for Lambda and Express.",
      title: "Unified Lifecycle",
    },
    {
      description:
        "Pre-built CDK constructs encode production patterns. S3 to SQS to Lambda. API Gateway to Express.",
      title: "Infrastructure as Code",
    },
    {
      description:
        "Native support for AI interactions with conversation history, tool calling, and multi-turn reasoning.",
      title: "LLM-First Design",
    },
    {
      description:
        "Complete test isolation with mocks for external services. Deterministic, fast, reliable.",
      title: "Comprehensive Testing",
    },
  ];

  return (
    <section className={styles.capabilities}>
      <div className={styles.capabilitiesInner}>
        <div className={styles.capabilitiesHeader}>
          <h2 className={styles.sectionTitle}>Capabilities</h2>
          <p className={styles.sectionSubtitle}>
            Everything you need for serverless TypeScript applications on AWS.
          </p>
        </div>
        <div className={styles.capabilitiesGrid}>
          {capabilities.map((capability, idx) => (
            <Capability key={idx} {...capability} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Install(): React.ReactElement {
  return (
    <section className={styles.install}>
      <div className={styles.installInner}>
        <div className={styles.installContent}>
          <h2 className={styles.installTitle}>Begin</h2>
          <p className={styles.installDescription}>
            Install the unified package or individual modules as needed.
          </p>
        </div>
        <div className={styles.installCode}>
          <div className={styles.codeBlock}>
            <code>npm install jaypie</code>
          </div>
        </div>
      </div>
    </section>
  );
}

interface PackageCardProps {
  description: string;
  href: string;
  name: string;
}

function PackageCard({ description, href, name }: PackageCardProps): React.ReactElement {
  return (
    <Link to={href} className={styles.packageCard}>
      <span className={styles.packageName}>{name}</span>
      <span className={styles.packageDescription}>{description}</span>
      <span className={styles.packageArrow}>→</span>
    </Link>
  );
}

function Packages(): React.ReactElement {
  const packages: PackageCardProps[] = [
    {
      description: "Handler lifecycle, logging, secrets, queues",
      href: "/docs/api/kit",
      name: "jaypie",
    },
    {
      description: "CDK constructs for AWS infrastructure",
      href: "/docs/api/constructs",
      name: "@jaypie/constructs",
    },
    {
      description: "LLM provider interface",
      href: "/docs/api/llm",
      name: "@jaypie/llm",
    },
    {
      description: "Express.js handler utilities",
      href: "/docs/api/express",
      name: "@jaypie/express",
    },
    {
      description: "Lambda handler utilities",
      href: "/docs/api/lambda",
      name: "@jaypie/lambda",
    },
    {
      description: "Testing mocks and utilities",
      href: "/docs/api/testkit",
      name: "@jaypie/testkit",
    },
  ];

  return (
    <section className={styles.packages}>
      <div className={styles.packagesInner}>
        <div className={styles.packagesHeader}>
          <h2 className={styles.sectionTitle}>Packages</h2>
          <p className={styles.sectionSubtitle}>
            Modular by design. Use what you need.
          </p>
        </div>
        <div className={styles.packagesGrid}>
          {packages.map((pkg, idx) => (
            <PackageCard key={idx} {...pkg} />
          ))}
        </div>
        <div className={styles.packagesMore}>
          <Link to="/docs/intro" className={styles.textLink}>
            View all packages →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Philosophy(): React.ReactElement {
  return (
    <section className={styles.philosophy}>
      <div className={styles.philosophyInner}>
        <blockquote className={styles.philosophyQuote}>
          <p>
            One language. One runtime. From infrastructure to application to
            testing. TypeScript everywhere.
          </p>
        </blockquote>
      </div>
    </section>
  );
}

export default function Home(): React.ReactElement {
  return (
    <Layout
      description="Event-driven TypeScript library for building serverless applications on AWS"
      title="Jaypie"
    >
      <main className={styles.main}>
        <Hero />
        <Capabilities />
        <Install />
        <Packages />
        <Philosophy />
      </main>
    </Layout>
  );
}

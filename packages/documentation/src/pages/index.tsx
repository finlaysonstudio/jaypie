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
        <p className={styles.heroEyebrow}>AWS/CDK · Datadog · TypeScript</p>
        <h1 className={styles.heroTitle}>Jaypie</h1>
        <p className={styles.heroSubtitle}>
          <span style={{ whiteSpace: "nowrap" }}>Complete-stack approach to</span>{" "}
          <span style={{ whiteSpace: "nowrap" }}>multi-environment cloud applications.</span>{" "}
          <span style={{ whiteSpace: "nowrap" }}>Aligns infrastructure, execution, and observability.</span>
        </p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} to="/docs">
            Documentation
          </Link>
          <Link className={styles.secondaryButton} to="/docs/packages/jaypie">
            Packages
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

function Capability({
  description,
  title,
}: CapabilityProps): React.ReactElement {
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
        "lambdaHandler and expressHandler share the same lifecycle: validate, setup, execute, teardown. Secrets loaded automatically. Errors formatted as JSON:API.",
      title: "Handler Lifecycle",
    },
    {
      description:
        "CDK constructs (JaypieLambda, JaypieDistribution) and runtime packages share environment variables, secrets patterns, and tagging conventions.",
      title: "Infrastructure + Runtime",
    },
    {
      description:
        "Request-scoped logging with trace IDs. Datadog Lambda layers and log forwarding configured via constructs. Metrics submission via submitMetric().",
      title: "Observability",
    },
    {
      description:
        "@jaypie/testkit provides mock factories for all packages. Custom matchers: toThrowJaypieError, toMatchUuid, toBeClass.",
      title: "Testing",
    },
  ];

  return (
    <section className={styles.capabilities}>
      <div className={styles.capabilitiesInner}>
        <div className={styles.capabilitiesHeader}>
          <h2 className={styles.sectionTitle}>What Jaypie Does</h2>
          <p className={styles.sectionSubtitle}>
            Shared patterns across infrastructure, execution, and testing.
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
          <h2 className={styles.installTitle}>Install</h2>
          <p className={styles.installDescription}>
            Main package or individual @jaypie/* packages.
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

interface PackageRowProps {
  href: string;
  name: string;
  purpose: string;
}

function PackageRow({
  href,
  name,
  purpose,
}: PackageRowProps): React.ReactElement {
  return (
    <Link to={href} className={styles.packageRow}>
      <span className={styles.packageRowName}>{name}</span>
      <span className={styles.packageRowPurpose}>{purpose}</span>
    </Link>
  );
}

function Packages(): React.ReactElement {
  const corePackages: PackageRowProps[] = [
    {
      href: "/docs/packages/jaypie",
      name: "jaypie",
      purpose: "Main package: re-exports express, lambda, errors, kit, logger",
    },
    {
      href: "/docs/packages/express",
      name: "@jaypie/express",
      purpose: "Express handler wrapper",
    },
    {
      href: "/docs/packages/lambda",
      name: "@jaypie/lambda",
      purpose: "Lambda handler wrapper",
    },
    {
      href: "/docs/packages/errors",
      name: "@jaypie/errors",
      purpose: "JSON:API error classes",
    },
    {
      href: "/docs/packages/logger",
      name: "@jaypie/logger",
      purpose: "Structured logging",
    },
    {
      href: "/docs/packages/kit",
      name: "@jaypie/kit",
      purpose: "Utilities: force, uuid, sleep",
    },
    {
      href: "/docs/packages/constructs",
      name: "@jaypie/constructs",
      purpose: "CDK constructs",
    },
    {
      href: "/docs/packages/llm",
      name: "@jaypie/llm",
      purpose: "LLM provider abstraction",
    },
    {
      href: "/docs/packages/testkit",
      name: "@jaypie/testkit",
      purpose: "Mocks and matchers",
    },
    {
      href: "/docs/packages/eslint",
      name: "@jaypie/eslint",
      purpose: "ESLint configuration",
    },
    {
      href: "/docs/packages/repokit",
      name: "@jaypie/repokit",
      purpose: "Repository tooling",
    },
  ];

  const experimentalPackages: PackageRowProps[] = [
    {
      href: "/docs/experimental/dynamodb",
      name: "@jaypie/dynamodb",
      purpose: "DynamoDB single-table patterns",
    },
    {
      href: "/docs/experimental/fabricator",
      name: "@jaypie/fabricator",
      purpose: "Test data generation",
    },
    {
      href: "/docs/experimental/mcp",
      name: "@jaypie/mcp",
      purpose: "Model Context Protocol server",
    },
    {
      href: "/docs/experimental/textract",
      name: "@jaypie/textract",
      purpose: "AWS Textract utilities",
    },
    {
      href: "/docs/experimental/vocabulary",
      name: "@jaypie/vocabulary",
      purpose: "Service handler adapters",
    },
  ];

  return (
    <section className={styles.packages}>
      <div className={styles.packagesInner}>
        <div className={styles.packagesHeader}>
          <h2 className={styles.sectionTitle}>Packages</h2>
        </div>
        <div className={styles.packageTables}>
          <div className={styles.packageTable}>
            <h3 className={styles.packageTableTitle}>Core 1.2</h3>
            <div className={styles.packageTableRows}>
              {corePackages.map((pkg, idx) => (
                <PackageRow key={idx} {...pkg} />
              ))}
            </div>
          </div>
          <div className={styles.packageTable}>
            <h3 className={styles.packageTableTitle}>Experimental 0.x</h3>
            <div className={styles.packageTableRows}>
              {experimentalPackages.map((pkg, idx) => (
                <PackageRow key={idx} {...pkg} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Patterns(): React.ReactElement {
  return (
    <section className={styles.patterns}>
      <div className={styles.patternsInner}>
        <div className={styles.patternsHeader}>
          <h2 className={styles.sectionTitle}>Common Patterns</h2>
        </div>
        <div className={styles.patternsGrid}>
          <div className={styles.patternBlock}>
            <h3 className={styles.patternTitle}>Type coercion</h3>
            <pre className={styles.patternCode}>
              <code>{`import { force } from "jaypie";

force.boolean("true")    // true
force.number("42")       // 42
force.array(singleItem)  // [singleItem]`}</code>
            </pre>
          </div>
          <div className={styles.patternBlock}>
            <h3 className={styles.patternTitle}>Environment checks</h3>
            <pre className={styles.patternCode}>
              <code>{`import { isProductionEnv, isLocalEnv } from "jaypie";

if (isProductionEnv()) {
  // production-only
}
if (isLocalEnv()) {
  // local development
}`}</code>
            </pre>
          </div>
          <div className={styles.patternBlock}>
            <h3 className={styles.patternTitle}>UUID generation</h3>
            <pre className={styles.patternCode}>
              <code>{`import { uuid } from "jaypie";

const id = uuid();`}</code>
            </pre>
          </div>
          <div className={styles.patternBlock}>
            <h3 className={styles.patternTitle}>Error handling</h3>
            <pre className={styles.patternCode}>
              <code>{`import { BadRequestError } from "jaypie";

throw BadRequestError("Invalid input");
// Returns 400 with JSON:API body`}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer(): React.ReactElement {
  return (
    <section className={styles.philosophy}>
      <div className={styles.philosophyInner}>
        <p className={styles.footerText}>
          TypeScript · Node.js 20-25 · AWS Lambda · Express.js · Vitest
        </p>
      </div>
    </section>
  );
}

export default function Home(): React.ReactElement {
  return (
    <Layout
      description="Complete-stack approach to multi-environment cloud applications. Aligns infrastructure, execution, and observability."
      title="Jaypie is TypeScript AWS/CDK + Datadog Application Patterns"
    >
      <main className={styles.main}>
        <Hero />
        <Capabilities />
        <Install />
        <Packages />
        <Patterns />
        <Footer />
      </main>
    </Layout>
  );
}

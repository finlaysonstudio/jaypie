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
          Complete-stack approach to multi-environment cloud application
          patterns. Aligns infrastructure, execution, and observability.
        </p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} to="/docs/intro">
            Documentation
          </Link>
          <Link className={styles.secondaryButton} to="/docs/api/kit">
            API Reference
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
      href: "/docs/api/kit",
      name: "jaypie",
      purpose: "Main package: re-exports aws, errors, express, kit, lambda, logger",
    },
    {
      href: "/docs/api/constructs",
      name: "@jaypie/constructs",
      purpose: "CDK constructs with Datadog integration",
    },
    {
      href: "/docs/api/errors",
      name: "@jaypie/errors",
      purpose: "JSON:API error classes",
    },
    {
      href: "/docs/api/eslint",
      name: "@jaypie/eslint",
      purpose: "ESLint configuration",
    },
    {
      href: "/docs/api/express",
      name: "@jaypie/express",
      purpose: "Express handler wrapper",
    },
    {
      href: "/docs/api/kit",
      name: "@jaypie/kit",
      purpose: "Utilities: force, uuid, constants",
    },
    {
      href: "/docs/api/lambda",
      name: "@jaypie/lambda",
      purpose: "Lambda handler wrapper",
    },
    {
      href: "/docs/api/llm",
      name: "@jaypie/llm",
      purpose: "LLM provider abstraction",
    },
    {
      href: "/docs/api/logger",
      name: "@jaypie/logger",
      purpose: "Structured logging",
    },
    {
      href: "/docs/api/repokit",
      name: "@jaypie/repokit",
      purpose: "Repository tooling",
    },
    {
      href: "/docs/api/testkit",
      name: "@jaypie/testkit",
      purpose: "Mocks and matchers",
    },
  ];

  const experimentalPackages: PackageRowProps[] = [
    {
      href: "/docs/api/aws",
      name: "@jaypie/aws",
      purpose: "AWS SDK utilities",
    },
    {
      href: "/docs/api/datadog",
      name: "@jaypie/datadog",
      purpose: "Datadog metrics submission",
    },
    {
      href: "/docs/intro",
      name: "@jaypie/dynamodb",
      purpose: "DynamoDB utilities and patterns",
    },
    {
      href: "/docs/intro",
      name: "@jaypie/fabricator",
      purpose: "Test data generation",
    },
    {
      href: "/docs/api/mcp",
      name: "@jaypie/mcp",
      purpose: "Model Context Protocol server",
    },
    {
      href: "/docs/api/mongoose",
      name: "@jaypie/mongoose",
      purpose: "MongoDB connection utilities",
    },
    {
      href: "/docs/api/textract",
      name: "@jaypie/textract",
      purpose: "AWS Textract document processing",
    },
    {
      href: "/docs/intro",
      name: "@jaypie/vocabulary",
      purpose: "Vocabulary and text utilities",
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
            <h3 className={styles.packageTableTitle}>Core</h3>
            <div className={styles.packageTableRows}>
              {corePackages.map((pkg, idx) => (
                <PackageRow key={idx} {...pkg} />
              ))}
            </div>
          </div>
          <div className={styles.packageTable}>
            <h3 className={styles.packageTableTitle}>Experimental</h3>
            <p className={styles.packageTableNote}>APIs may change.</p>
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
      description="Complete-stack approach to multi-environment cloud application patterns. Aligns infrastructure, execution, and observability."
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

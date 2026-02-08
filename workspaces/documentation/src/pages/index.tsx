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
          <span style={{ whiteSpace: "nowrap" }}>
            Complete-stack approach to
          </span>{" "}
          <span style={{ whiteSpace: "nowrap" }}>
            multi-environment cloud applications.
          </span>{" "}
          <span style={{ whiteSpace: "nowrap" }}>
            Aligns infrastructure, execution, and observability.
          </span>
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
        "JaypieLambda, JaypieDistribution, and more CDK constructs for AWS infrastructure with consistent patterns.",
      title: "Serverless CDK Constructs",
    },
    {
      description:
        "Lambda layers, log forwarding, and metrics submission configured automatically via constructs.",
      title: "Datadog Instrumentation",
    },
    {
      description:
        "Handler lifecycle, secrets management, error handling, and logging patterns for production applications.",
      title: "Industrial Application Patterns",
    },
    {
      description:
        "@jaypie/testkit provides mock factories for all packages. Custom matchers: toThrowJaypieError, toMatchUuid, toBeClass.",
      title: "Complete Mock Coverage",
    },
  ];

  return (
    <section className={styles.capabilities}>
      <div className={styles.capabilitiesInner}>
        <div className={styles.capabilitiesHeader}>
          <h2 className={styles.sectionTitle}>What Jaypie Provides</h2>
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
  const mainPackages: PackageRowProps[] = [
    {
      href: "/docs/packages/jaypie",
      name: "jaypie",
      purpose: "Main package: re-exports express, lambda, errors, kit, logger",
    },
    {
      href: "/docs/api/datadog",
      name: "@jaypie/datadog",
      purpose: "Datadog integration utilities",
    },
    {
      href: "/docs/packages/errors",
      name: "@jaypie/errors",
      purpose: "JSON:API error classes",
    },
    {
      href: "/docs/packages/express",
      name: "@jaypie/express",
      purpose: "Express handler wrapper",
    },
    {
      href: "/docs/packages/kit",
      name: "@jaypie/kit",
      purpose: "Utilities: force, uuid, sleep",
    },
    {
      href: "/docs/packages/lambda",
      name: "@jaypie/lambda",
      purpose: "Lambda handler wrapper",
    },
  ];

  const libraryPackages: PackageRowProps[] = [
    {
      href: "/docs/packages/constructs",
      name: "@jaypie/constructs",
      purpose: "CDK constructs",
    },
    {
      href: "/docs/packages/eslint",
      name: "@jaypie/eslint",
      purpose: "ESLint configuration",
    },
    {
      href: "/docs/packages/llm",
      name: "@jaypie/llm",
      purpose: "LLM provider abstraction",
    },
    {
      href: "/docs/packages/repokit",
      name: "@jaypie/repokit",
      purpose: "Repository tooling",
    },
    {
      href: "/docs/packages/testkit",
      name: "@jaypie/testkit",
      purpose: "Mocks and matchers",
    },
  ];

  const experimentalPackages: PackageRowProps[] = [
    {
      href: "/docs/experimental/dynamodb",
      name: "@jaypie/dynamodb",
      purpose: "DynamoDB single-table patterns",
    },
    {
      href: "/docs/experimental/fabric",
      name: "@jaypie/fabric",
      purpose: "Data fabric utilities",
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
  ];

  return (
    <section className={styles.packages}>
      <div className={styles.packagesInner}>
        <div className={styles.packagesHeader}>
          <h2 className={styles.sectionTitle}>Packages</h2>
        </div>
        <div className={styles.packageTables}>
          <div className={styles.packageTable}>
            <h3 className={styles.packageTableTitle}>1.2 Main</h3>
            <div className={styles.packageTableRows}>
              {mainPackages.map((pkg, idx) => (
                <PackageRow key={idx} {...pkg} />
              ))}
            </div>
          </div>
          <div className={styles.packageTable}>
            <h3 className={styles.packageTableTitle}>1.2 Library</h3>
            <div className={styles.packageTableRows}>
              {libraryPackages.map((pkg, idx) => (
                <PackageRow key={idx} {...pkg} />
              ))}
            </div>
          </div>
          <div className={styles.packageTable}>
            <h3 className={styles.packageTableTitle}>0.x Experimental</h3>
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
          <h2 className={styles.sectionTitle}>Complete Stack</h2>
        </div>
        <div className={styles.patternsGrid}>
          <div className={styles.patternBlock}>
            <h3 className={styles.patternTitle}>CDK</h3>
            <pre className={styles.patternCode}>
              <code>{`import { JaypieLambda } from "@jaypie/constructs";

new JaypieLambda(this, "Handler", {
  entry: "src/handler.ts",
  secrets: ["MONGODB_URI"],
});`}</code>
            </pre>
          </div>
          <div className={styles.patternBlock}>
            <h3 className={styles.patternTitle}>Express</h3>
            <pre className={styles.patternCode}>
              <code>{`import { expressHandler } from "jaypie";

export default expressHandler(async (req, res) => {
  return { message: "Hello, World!" };
});`}</code>
            </pre>
          </div>
          <div className={styles.patternBlock}>
            <h3 className={styles.patternTitle}>Test</h3>
            <pre className={styles.patternCode}>
              <code>{`import { matchers, mockLogFactory } from "@jaypie/testkit";

expect.extend(matchers);
vi.mock("jaypie", mockLogFactory);`}</code>
            </pre>
          </div>
          <div className={styles.patternBlock}>
            <h3 className={styles.patternTitle}>CI/CD</h3>
            <pre className={styles.patternCode}>
              <code>{`# npm-check.yml
- run: npm run lint
- run: npm run typecheck
- run: npm run test
- run: npm run build`}</code>
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
          TypeScript · Node.js 22-25 · AWS Lambda · Express.js · Vitest
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
        <Packages />
        <Patterns />
        <Footer />
      </main>
    </Layout>
  );
}

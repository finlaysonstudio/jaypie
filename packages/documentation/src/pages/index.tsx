import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "./index.module.css";

interface Feature {
  title: string;
  description: React.ReactElement;
}

function HomepageHeader(): React.ReactElement {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>
      <div className="container">
        <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
        <p className={styles.heroTagline}>{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/intro">
            Get Started
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/api/core">
            API Reference
          </Link>
        </div>
      </div>
    </header>
  );
}

function HomepageFeatures(): React.ReactElement {
  const features: Feature[] = [
    {
      title: "Unified Handler Lifecycle",
      description: (
        <>
          Single <code>jaypieHandler</code> function manages validate → setup →
          handler → teardown phases for both Lambda and Express.
        </>
      ),
    },
    {
      title: "Event-Driven Patterns",
      description: (
        <>
          Pre-built CDK constructs encode best practices (S3→SQS→Lambda, API
          Gateway→Express).
        </>
      ),
    },
    {
      title: "LLM-First",
      description: (
        <>
          Native support for AI interactions with conversation history, tool
          calling, and multi-turn reasoning.
        </>
      ),
    },
    {
      title: "Infrastructure as Code",
      description: (
        <>
          All infrastructure defined in TypeScript via AWS CDK - no YAML or JSON
          configuration files.
        </>
      ),
    },
    {
      title: "Comprehensive Testing",
      description: (
        <>
          Complete test isolation with mocks for all external services via{" "}
          <code>@jaypie/testkit</code>.
        </>
      ),
    },
    {
      title: "JavaScript Only",
      description: (
        <>
          Use a single language across backend, infrastructure, and tooling for
          maximum developer productivity.
        </>
      ),
    },
  ];

  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.featureGrid}>
          {features.map((feature, idx) => (
            <div key={idx} className={styles.feature}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomepageQuickStart(): React.ReactElement {
  return (
    <section className={styles.quickStart}>
      <div className="container">
        <h2>Quick Start</h2>
        <p>Install the main Jaypie package:</p>
        <pre>
          <code>npm install @jaypie/jaypie</code>
        </pre>
        <p>Or install individual packages as needed:</p>
        <pre>
          <code>npm install @jaypie/core @jaypie/express @jaypie/lambda</code>
        </pre>
      </div>
    </section>
  );
}

export default function Home(): React.ReactElement {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - ${siteConfig.tagline}`}
      description="Event-driven JavaScript library for building serverless applications on AWS">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HomepageQuickStart />
      </main>
    </Layout>
  );
}

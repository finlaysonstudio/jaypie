import { Construct } from "constructs";
import {
  envHostname,
  JaypieAppStack,
  JaypieStaticWebBucket,
  JaypieStaticWebBucketProps,
} from "@jaypie/constructs";

const DEFAULT_ZONE = "jaypie.net";

export interface DocumentationStackProps {
  /**
   * Override the default host for the documentation site
   * @default envHostname() - e.g., "jaypie.net" for production, "sandbox.jaypie.net" for sandbox
   */
  host?: string;
  /**
   * Override the default hosted zone
   * @default CDK_ENV_HOSTED_ZONE or "jaypie.net"
   */
  zone?: string;
}

export class DocumentationStack extends JaypieAppStack {
  public readonly bucket: JaypieStaticWebBucket;

  constructor(
    scope: Construct,
    id?: string,
    props: DocumentationStackProps = {},
  ) {
    super(scope, id ?? "JaypieDocumentationStack", { key: "documentation" });

    const zone = props.zone ?? process.env.CDK_ENV_HOSTED_ZONE ?? DEFAULT_ZONE;
    // envHostname handles PROJECT_ENV: production gets apex, others get env prefix (e.g., sandbox.jaypie.net)
    const host = props.host ?? envHostname({ domain: zone });

    const bucketProps: JaypieStaticWebBucketProps = {
      host,
      zone,
    };

    this.bucket = new JaypieStaticWebBucket(
      this,
      "DocumentationBucket",
      bucketProps,
    );
  }
}

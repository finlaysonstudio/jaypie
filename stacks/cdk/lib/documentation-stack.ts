import { Construct } from "constructs";
import {
  JaypieAppStack,
  JaypieStaticWebBucket,
  JaypieStaticWebBucketProps,
} from "@jaypie/constructs";

const DOCUMENTATION_HOST = "jaypie.net";
const DOCUMENTATION_ZONE = "jaypie.net";

export interface DocumentationStackProps {
  /**
   * Override the default host for the documentation site
   * @default "jaypie.net"
   */
  host?: string;
  /**
   * Override the default hosted zone
   * @default "jaypie.net"
   */
  zone?: string;
}

export class DocumentationStack extends JaypieAppStack {
  public readonly bucket: JaypieStaticWebBucket;

  constructor(scope: Construct, id?: string, props: DocumentationStackProps = {}) {
    super(scope, id ?? "JaypieDocumentationStack", { key: "documentation" });

    const host = props.host ?? DOCUMENTATION_HOST;
    const zone = props.zone ?? DOCUMENTATION_ZONE;

    const bucketProps: JaypieStaticWebBucketProps = {
      host,
      zone,
    };

    this.bucket = new JaypieStaticWebBucket(this, "DocumentationBucket", bucketProps);
  }
}

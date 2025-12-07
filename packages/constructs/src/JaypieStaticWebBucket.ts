import { Construct } from "constructs";

import { CDK } from "./constants";
import { constructEnvName, envHostname } from "./helpers";
import {
  JaypieWebDeploymentBucket,
  JaypieWebDeploymentBucketProps,
} from "./JaypieWebDeploymentBucket";

export interface JaypieStaticWebBucketProps
  extends Omit<JaypieWebDeploymentBucketProps, "host" | "name" | "roleTag"> {
  /**
   * The domain name for the website
   * @default envHostname({ subdomain: "static" })
   */
  host?: string;
  /**
   * Optional bucket name
   * @default constructEnvName("static")
   */
  name?: string;
  /**
   * Role tag for tagging resources
   * @default CDK.ROLE.HOSTING
   */
  roleTag?: string;
}

export class JaypieStaticWebBucket extends JaypieWebDeploymentBucket {
  constructor(
    scope: Construct,
    id?: string | JaypieStaticWebBucketProps,
    props: JaypieStaticWebBucketProps = {},
  ) {
    // Handle overloaded signatures: (scope), (scope, props), (scope, id, props)
    let resolvedId: string;
    let resolvedProps: JaypieStaticWebBucketProps;

    if (typeof id === "string") {
      resolvedId = id;
      resolvedProps = props;
    } else if (typeof id === "object") {
      resolvedId = "JaypieStaticWebBucket";
      resolvedProps = id;
    } else {
      resolvedId = "JaypieStaticWebBucket";
      resolvedProps = props;
    }

    const host = resolvedProps.host ?? envHostname({ subdomain: "static" });
    const name = resolvedProps.name ?? constructEnvName("static");
    const roleTag = resolvedProps.roleTag ?? CDK.ROLE.HOSTING;
    // Only use default zone if zone is not explicitly provided (including undefined)
    const zone =
      "zone" in resolvedProps
        ? resolvedProps.zone
        : process.env.CDK_ENV_DOMAIN || process.env.CDK_ENV_HOSTED_ZONE;

    super(scope, resolvedId, {
      ...resolvedProps,
      host,
      name,
      roleTag,
      zone,
    });
  }
}

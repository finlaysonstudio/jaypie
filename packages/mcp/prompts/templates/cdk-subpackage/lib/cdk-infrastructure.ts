import {
  JaypieInfrastructureStack,
  JaypieWebDeploymentBucket,
} from "@jaypie/constructs";

export class InfrastructureStack extends JaypieInfrastructureStack {
  constructor(scope, id, props = {}) {
    super(scope, id, props);

    new JaypieWebDeploymentBucket(this, "DeploymentBucket", {
      // * host is not needed if CDK_ENV_WEB_SUBDOMAIN and CDK_ENV_WEB_HOSTED_ZONE or CDK_ENV_HOSTED_ZONE 
      // * zone is not needed if CDK_ENV_WEB_HOSTED_ZONE or CDK_ENV_HOSTED_ZONE
    });
  }
}

import {
  envHostname,
  jaypieLambdaEnv,
  resolveHostedZone,
} from "@jaypie/constructs";
import { IHostedZone } from "aws-cdk-lib/aws-route53";
import { Nextjs } from "cdk-nextjs-standalone";
import { Construct } from "constructs";
import * as path from "path";

import { addDatadogLayers, resolveParamsAndSecrets } from "./helpers";

export interface JaypieNextjsProps {
  domainName?: string;
  datadogApiKeyArn?: string;
  hostedZone?: IHostedZone | string;
  nextjsPath?: string;
}

export class JaypieNextJs extends Construct {
  constructor(scope: Construct, id: string, props?: JaypieNextjsProps) {
    super(scope, id);

    const domainName = props?.domainName || envHostname();
    const nextjsPath = props?.nextjsPath?.startsWith("..")
      ? path.join(process.cwd(), props.nextjsPath)
      : props?.nextjsPath || path.join(process.cwd(), "..", "nextjs");
    const paramsAndSecrets = resolveParamsAndSecrets();

    const nextjs = new Nextjs(this, "NextJsApp", {
      nextjsPath,
      domainProps: {
        domainName,
        hostedZone: resolveHostedZone(this, {
          zone: props?.hostedZone,
        }),
      },
      environment: jaypieLambdaEnv(),
      overrides: {
        nextjsServer: {
          functionProps: {
            paramsAndSecrets,
          },
        },
        nextjsImage: {
          functionProps: {
            paramsAndSecrets,
          },
        },
      },
    });

    addDatadogLayers(nextjs.imageOptimizationFunction);
    addDatadogLayers(nextjs.serverFunction.lambdaFunction);
  }
}

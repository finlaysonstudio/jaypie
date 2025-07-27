import {
  JaypieAppStack,
  JaypieApiGateway,
  JaypieExpressLambda,
  JaypieMongoDbSecret,
  JaypieLambda,
} from "@jaypie/constructs";

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class AppStack extends JaypieAppStack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const mongoConnectionString = new JaypieMongoDbSecret(this);

    const expressLambda = new JaypieExpressLambda(this, "expressLambda", {
      code: lambda.Code.fromAsset("../express"),
      handler: "dist/index.expressLambda",
      secrets: [mongoConnectionString],
    });

    new JaypieApiGateway(this, "apiGateway", {
      handler: expressLambda,
      host: "api.example.com",
      zone: "example.com",
    });

    new JaypieLambda(
      this,
      "lambdaWorker",
      {
        code: lambda.Code.fromAsset("../lambda"),
        handler: "dist/index.lambdaWorker",
        secrets: [mongoConnectionString],
      },
    );
  }
}

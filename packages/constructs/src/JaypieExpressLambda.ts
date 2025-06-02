import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import { CDK } from "@jaypie/cdk";
import { JaypieLambda, JaypieLambdaProps } from "./JaypieLambda.js";

export class JaypieExpressLambda extends JaypieLambda {
  constructor(scope: Construct, id: string, props: JaypieLambdaProps) {
    super(scope, id, {
      timeout: Duration.seconds(CDK.DURATION.EXPRESS_API),
      roleTag: CDK.ROLE.API,
      ...props,
    });
  }
}

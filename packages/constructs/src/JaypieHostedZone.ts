import { CDK } from "@jaypie/cdk";
import * as cdk from "aws-cdk-lib";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  LogGroup,
  FilterPattern,
  RetentionDays,
  ILogGroup,
} from "aws-cdk-lib/aws-logs";
import { HostedZone, IHostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { LambdaDestination } from "aws-cdk-lib/aws-logs-destinations";

const SERVICE = {
  ROUTE53: "route53.amazonaws.com",
} as const;

interface JaypieHostedZoneProps {
  /**
   * The domain name for the hosted zone
   */
  zoneName: string;
  /**
   * The service tag value
   * @default CDK.SERVICE.INFRASTRUCTURE
   */
  service?: string;
  /**
   * Optional project tag value
   */
  project?: string;
  /**
   * Optional log destination
   */
  destination?: LambdaDestination;
}

export class JaypieHostedZone extends Construct {
  public readonly hostedZone: IHostedZone;
  public readonly logGroup: ILogGroup;

  /**
   * Create a new hosted zone with query logging
   */
  constructor(scope: Construct, id: string, props: JaypieHostedZoneProps) {
    super(scope, id);

    const { destination, zoneName, project } = props;
    const service = props.service || CDK.SERVICE.INFRASTRUCTURE;

    // Create the log group
    this.logGroup = new LogGroup(this, "LogGroup", {
      logGroupName: process.env.PROJECT_NONCE
        ? `/aws/route53/${zoneName}-${process.env.PROJECT_NONCE}`
        : `/aws/route53/${zoneName}`,
      retention: RetentionDays.ONE_WEEK,
    });

    // Add tags
    cdk.Tags.of(this.logGroup).add(CDK.TAG.SERVICE, service);
    cdk.Tags.of(this.logGroup).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
    if (project) {
      cdk.Tags.of(this.logGroup).add(CDK.TAG.PROJECT, project);
    }

    // Grant Route 53 permissions to write to the log group
    this.logGroup.grantWrite(new ServicePrincipal(SERVICE.ROUTE53));

    // Add destination if provided
    if (destination) {
      this.logGroup.addSubscriptionFilter("DatadogLambdaDestination", {
        destination,
        filterPattern: FilterPattern.allEvents(),
      });
    }

    // Create the hosted zone
    this.hostedZone = new HostedZone(this, "HostedZone", {
      queryLogsLogGroupArn: this.logGroup.logGroupArn,
      zoneName,
    });

    // Add tags
    cdk.Tags.of(this.hostedZone).add(CDK.TAG.SERVICE, service);
    cdk.Tags.of(this.hostedZone).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
    if (project) {
      cdk.Tags.of(this.hostedZone).add(CDK.TAG.PROJECT, project);
    }
  }
}

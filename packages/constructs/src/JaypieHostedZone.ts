import { CDK } from "@jaypie/cdk";
import * as cdk from "aws-cdk-lib";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  FilterPattern,
  ILogGroup,
  LogGroup,
  RetentionDays,
} from "aws-cdk-lib/aws-logs";
import { LambdaDestination } from "aws-cdk-lib/aws-logs-destinations";
import { HostedZone, IHostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

import { resolveDatadogLoggingDestination } from "./helpers/resolveDatadogLoggingDestination";
import { JaypieDnsRecord, JaypieDnsRecordProps } from "./JaypieDnsRecord";

const SERVICE = {
  ROUTE53: "route53.amazonaws.com",
} as const;

/**
 * DNS record configuration for JaypieHostedZone
 * Omits 'zone' since it will be automatically set to the created hosted zone
 */
export interface JaypieHostedZoneRecordProps
  extends Omit<JaypieDnsRecordProps, "zone"> {
  /**
   * Optional ID for the DNS record construct
   * @default Generated from record type and name
   */
  id?: string;
}

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
   * Log destination configuration
   * - LambdaDestination: Use a specific Lambda destination
   * - true: Use Datadog logging destination (default)
   * - false: Do not use a destination
   * @default true
   */
  destination?: LambdaDestination | boolean;
  /**
   * Optional DNS records to create for this hosted zone
   * Each record will be created as a JaypieDnsRecord construct
   */
  records?: JaypieHostedZoneRecordProps[];
}

export class JaypieHostedZone extends Construct {
  public readonly hostedZone: IHostedZone;
  public readonly logGroup: ILogGroup;
  public readonly dnsRecords: JaypieDnsRecord[];

  /**
   * Create a new hosted zone with query logging and optional DNS records
   */
  constructor(scope: Construct, id: string, props: JaypieHostedZoneProps) {
    super(scope, id);

    const { zoneName, project } = props;
    const destination = props.destination ?? true;
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

    // Add destination based on configuration
    if (destination !== false) {
      const lambdaDestination =
        destination === true
          ? resolveDatadogLoggingDestination(scope)
          : destination;

      this.logGroup.addSubscriptionFilter("DatadogLambdaDestination", {
        destination: lambdaDestination,
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

    // Create DNS records if provided
    this.dnsRecords = [];
    if (props.records) {
      props.records.forEach((recordConfig, index) => {
        const { id, ...recordProps } = recordConfig;
        // Generate a default ID if not provided
        const recordId =
          id ||
          `${recordProps.type}${recordProps.recordName ? `-${recordProps.recordName}` : ""}-${index}`;

        const dnsRecord = new JaypieDnsRecord(this, recordId, {
          ...recordProps,
          zone: this.hostedZone,
        });

        this.dnsRecords.push(dnsRecord);
      });
    }
  }
}

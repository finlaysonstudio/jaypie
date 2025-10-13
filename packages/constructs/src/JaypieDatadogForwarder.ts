import { CDK } from "./constants";
import * as cdk from "aws-cdk-lib";
import { CfnStack } from "aws-cdk-lib";
import { Rule, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { extendDatadogRole } from "./helpers/extendDatadogRole";

const DATADOG_FORWARDER_TEMPLATE_URL =
  "https://datadog-cloudformation-template.s3.amazonaws.com/aws/forwarder/latest.yaml";
const DEFAULT_RESERVED_CONCURRENCY = "10";

export interface JaypieDatadogForwarderProps {
  /**
   * Optional construct ID
   * @default "DatadogForwarder"
   */
  id?: string;

  /**
   * Datadog API key
   * @default process.env.CDK_ENV_DATADOG_API_KEY
   */
  datadogApiKey?: string;

  /**
   * Account identifier for Datadog tags
   * @default process.env.CDK_ENV_ACCOUNT
   */
  account?: string;

  /**
   * Reserved concurrency for the forwarder Lambda
   * Must be a string as required by the CloudFormation template
   * @default "10"
   */
  reservedConcurrency?: string;

  /**
   * Additional Datadog tags (comma-separated)
   * Will be appended to account tag
   */
  additionalTags?: string;

  /**
   * The service tag value
   * @default CDK.VENDOR.DATADOG
   */
  service?: string;

  /**
   * Optional project tag value
   */
  project?: string;

  /**
   * Whether to create CloudFormation events rule
   * @default true
   */
  enableCloudFormationEvents?: boolean;

  /**
   * Whether to extend Datadog role with custom permissions
   * Uses CDK_ENV_DATADOG_ROLE_ARN if set
   * @default true
   */
  enableRoleExtension?: boolean;

  /**
   * Whether to create CloudFormation output for forwarder ARN
   * @default true
   */
  createOutput?: boolean;

  /**
   * Custom export name for the forwarder ARN output
   * @default CDK.IMPORT.DATADOG_LOG_FORWARDER
   */
  exportName?: string;

  /**
   * URL to Datadog forwarder CloudFormation template
   * @default "https://datadog-cloudformation-template.s3.amazonaws.com/aws/forwarder/latest.yaml"
   */
  templateUrl?: string;
}

export class JaypieDatadogForwarder extends Construct {
  public readonly cfnStack: CfnStack;
  public readonly forwarderFunction: IFunction;
  public readonly eventsRule?: Rule;

  /**
   * Create a new Datadog forwarder with CloudFormation nested stack
   */
  constructor(
    scope: Construct,
    idOrProps?: string | JaypieDatadogForwarderProps,
    propsOrUndefined?: JaypieDatadogForwarderProps,
  ) {
    // Handle overloaded constructor signatures
    let props: JaypieDatadogForwarderProps;
    let id: string;

    if (typeof idOrProps === "string") {
      // First param is ID, second is props
      props = propsOrUndefined || {};
      id = idOrProps;
    } else {
      // First param is props
      props = idOrProps || {};
      id = props.id || "DatadogForwarder";
    }

    super(scope, id);

    // Resolve options with defaults
    const {
      account = process.env.CDK_ENV_ACCOUNT,
      additionalTags,
      createOutput = true,
      datadogApiKey = process.env.CDK_ENV_DATADOG_API_KEY,
      enableCloudFormationEvents = true,
      enableRoleExtension = true,
      exportName = CDK.IMPORT.DATADOG_LOG_FORWARDER,
      project,
      reservedConcurrency = DEFAULT_RESERVED_CONCURRENCY,
      service = CDK.VENDOR.DATADOG,
      templateUrl = DATADOG_FORWARDER_TEMPLATE_URL,
    } = props;

    // Validate required parameters
    if (!datadogApiKey) {
      throw new Error(
        "Datadog API key is required. Provide via datadogApiKey prop or CDK_ENV_DATADOG_API_KEY environment variable.",
      );
    }

    // Build Datadog tags
    let ddTags = account ? `account:${account}` : "";
    if (additionalTags) {
      ddTags = ddTags ? `${ddTags},${additionalTags}` : additionalTags;
    }

    // Deploy Datadog CloudFormation stack
    this.cfnStack = new CfnStack(this, "Stack", {
      parameters: {
        DdApiKey: datadogApiKey,
        DdTags: ddTags,
        ReservedConcurrency: reservedConcurrency,
      },
      templateUrl,
    });

    // Add tags to stack
    cdk.Tags.of(this.cfnStack).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
    cdk.Tags.of(this.cfnStack).add(CDK.TAG.SERVICE, service);
    cdk.Tags.of(this.cfnStack).add(CDK.TAG.VENDOR, CDK.VENDOR.DATADOG);
    if (project) {
      cdk.Tags.of(this.cfnStack).add(CDK.TAG.PROJECT, project);
    }

    // Extract forwarder function from stack outputs
    this.forwarderFunction = lambda.Function.fromFunctionArn(
      this,
      "Function",
      this.cfnStack.getAtt("Outputs.DatadogForwarderArn").toString(),
    );

    // Extend Datadog role with custom permissions if enabled
    if (enableRoleExtension) {
      extendDatadogRole(this, { project, service });
    }

    // Create CloudFormation events rule if enabled
    if (enableCloudFormationEvents) {
      this.eventsRule = new Rule(this, "CloudFormationEventsRule", {
        eventPattern: {
          source: ["aws.cloudformation"],
        },
        targets: [
          new LambdaFunction(this.forwarderFunction, {
            event: RuleTargetInput.fromEventPath("$"),
          }),
        ],
      });

      // Add tags to events rule
      cdk.Tags.of(this.eventsRule).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
      cdk.Tags.of(this.eventsRule).add(CDK.TAG.SERVICE, service);
      cdk.Tags.of(this.eventsRule).add(CDK.TAG.VENDOR, CDK.VENDOR.DATADOG);
      if (project) {
        cdk.Tags.of(this.eventsRule).add(CDK.TAG.PROJECT, project);
      }
    }

    // Create CloudFormation output if enabled
    if (createOutput) {
      new cdk.CfnOutput(this, "ForwarderArnOutput", {
        description: "Datadog Log Forwarder Lambda ARN",
        exportName,
        value: this.cfnStack.getAtt("Outputs.DatadogForwarderArn").toString(),
      });
    }
  }
}

import { CDK } from "./constants";
import * as cdk from "aws-cdk-lib";
import { Rule, RuleProps, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { resolveDatadogForwarderFunction } from "./helpers/resolveDatadogForwarderFunction";

export interface JaypieEventsRuleProps extends Omit<RuleProps, "targets"> {
  /**
   * Optional construct ID
   * @default Generated from source or "EventsRule"
   */
  id?: string;

  /**
   * Event source(s) to match
   * @default undefined
   */
  source?: string | string[];

  /**
   * Lambda function to target
   * Can be:
   * - An IFunction instance
   * - undefined (will resolve Datadog forwarder)
   * @default Resolves Datadog forwarder via resolveDatadogForwarderFunction
   */
  targetFunction?: IFunction;

  /**
   * The service tag value
   * @default CDK.SERVICE.DATADOG
   */
  service?: string;

  /**
   * The vendor tag value
   * @default CDK.VENDOR.DATADOG
   */
  vendor?: string;

  /**
   * Optional project tag value
   */
  project?: string;
}

export class JaypieEventsRule extends Construct {
  public readonly rule: Rule;
  public readonly targetFunction: IFunction;

  /**
   * Create a new EventBridge rule that targets a Lambda function
   */
  constructor(
    scope: Construct,
    idOrSourceOrProps?: string | JaypieEventsRuleProps,
    propsOrUndefined?: JaypieEventsRuleProps,
  ) {
    // Handle overloaded constructor signatures
    let props: JaypieEventsRuleProps;
    let id: string;

    if (typeof idOrSourceOrProps === "string") {
      // Check if it looks like an AWS source (starts with "aws.")
      if (idOrSourceOrProps.startsWith("aws.")) {
        // First param is source, second is props
        props = propsOrUndefined || {};
        props.source = idOrSourceOrProps;
        // Generate ID from source
        const sourceName = idOrSourceOrProps
          .replace("aws.", "")
          .split(".")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("");
        id = props.id || `${sourceName}EventsRule`;
      } else {
        // First param is ID, second is props
        props = propsOrUndefined || {};
        id = idOrSourceOrProps;
      }
    } else {
      // First param is props
      props = idOrSourceOrProps || {};
      if (props.source) {
        const sourceName =
          typeof props.source === "string"
            ? props.source
                .replace("aws.", "")
                .split(".")
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join("")
            : "Events";
        id = props.id || `${sourceName}EventsRule`;
      } else {
        id = props.id || "EventsRule";
      }
    }

    super(scope, id);

    // Extract Jaypie-specific options

    const {
      id: _id,
      project,
      service = CDK.SERVICE.DATADOG,
      source,
      targetFunction,
      vendor = CDK.VENDOR.DATADOG,
      ...ruleProps
    } = props;

    // Resolve target function
    this.targetFunction =
      targetFunction || resolveDatadogForwarderFunction(scope);

    // Build event pattern if source is specified
    const eventPattern = source
      ? {
          ...ruleProps.eventPattern,
          source: Array.isArray(source) ? source : [source],
        }
      : ruleProps.eventPattern;

    // Build rule props
    const finalRuleProps: RuleProps = {
      ...ruleProps,
      eventPattern,
      targets: [
        new LambdaFunction(this.targetFunction, {
          event: RuleTargetInput.fromEventPath("$"),
        }),
      ],
    };

    // Create the rule
    this.rule = new Rule(this, "Rule", finalRuleProps);

    // Add tags
    cdk.Tags.of(this.rule).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
    cdk.Tags.of(this.rule).add(CDK.TAG.SERVICE, service);
    cdk.Tags.of(this.rule).add(CDK.TAG.VENDOR, vendor);
    if (project) {
      cdk.Tags.of(this.rule).add(CDK.TAG.PROJECT, project);
    }
  }
}

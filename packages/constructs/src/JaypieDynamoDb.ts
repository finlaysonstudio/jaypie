import { Construct } from "constructs";
import { RemovalPolicy, Tags } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { CDK } from "./constants";
import { isProductionEnv } from "./helpers/isEnv";

//
//
// Constants
//

/**
 * GSI attribute names used in Jaypie single-table design
 */
const GSI_NAMES = {
  ALIAS: "indexAlias",
  CLASS: "indexClass",
  SCOPE: "indexScope",
  TYPE: "indexType",
  XID: "indexXid",
} as const;

/**
 * Individual GSI definitions for Jaypie single-table design.
 * All GSIs use a string partition key and numeric sort key (sequence).
 */
const GlobalSecondaryIndex = {
  Alias: {
    indexName: GSI_NAMES.ALIAS,
    partitionKey: {
      name: GSI_NAMES.ALIAS,
      type: dynamodb.AttributeType.STRING,
    },
    projectionType: dynamodb.ProjectionType.ALL,
    sortKey: { name: "sequence", type: dynamodb.AttributeType.NUMBER },
  } as dynamodb.GlobalSecondaryIndexPropsV2,
  Class: {
    indexName: GSI_NAMES.CLASS,
    partitionKey: {
      name: GSI_NAMES.CLASS,
      type: dynamodb.AttributeType.STRING,
    },
    projectionType: dynamodb.ProjectionType.ALL,
    sortKey: { name: "sequence", type: dynamodb.AttributeType.NUMBER },
  } as dynamodb.GlobalSecondaryIndexPropsV2,
  Scope: {
    indexName: GSI_NAMES.SCOPE,
    partitionKey: { name: GSI_NAMES.SCOPE, type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL,
    sortKey: { name: "sequence", type: dynamodb.AttributeType.NUMBER },
  } as dynamodb.GlobalSecondaryIndexPropsV2,
  Type: {
    indexName: GSI_NAMES.TYPE,
    partitionKey: { name: GSI_NAMES.TYPE, type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL,
    sortKey: { name: "sequence", type: dynamodb.AttributeType.NUMBER },
  } as dynamodb.GlobalSecondaryIndexPropsV2,
  Xid: {
    indexName: GSI_NAMES.XID,
    partitionKey: { name: GSI_NAMES.XID, type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL,
    sortKey: { name: "sequence", type: dynamodb.AttributeType.NUMBER },
  } as dynamodb.GlobalSecondaryIndexPropsV2,
} as const;

/**
 * Array of all default Jaypie GSI definitions.
 * Used when no globalSecondaryIndexes are provided.
 */
const GlobalSecondaryIndexes: dynamodb.GlobalSecondaryIndexPropsV2[] = [
  GlobalSecondaryIndex.Alias,
  GlobalSecondaryIndex.Class,
  GlobalSecondaryIndex.Scope,
  GlobalSecondaryIndex.Type,
  GlobalSecondaryIndex.Xid,
];

//
//
// Types
//

export interface JaypieDynamoDbProps extends Omit<
  dynamodb.TablePropsV2,
  "globalSecondaryIndexes" | "partitionKey" | "sortKey"
> {
  /**
   * Configure GSIs for the table.
   * - `undefined` or `true`: Creates all five Jaypie GSIs (Alias, Class, Scope, Type, Xid)
   * - `false`: No GSIs
   * - Array: Use the specified GSIs
   */
  globalSecondaryIndexes?: boolean | dynamodb.GlobalSecondaryIndexPropsV2[];
  /**
   * Partition key attribute definition.
   * @default { name: "model", type: AttributeType.STRING }
   */
  partitionKey?: dynamodb.Attribute;
  /**
   * Optional project identifier for tagging
   */
  project?: string;
  /**
   * Optional role tag for the table
   */
  roleTag?: string;
  /**
   * Optional service identifier for tagging
   */
  service?: string;
  /**
   * Sort key attribute definition.
   * @default { name: "id", type: AttributeType.STRING }
   */
  sortKey?: dynamodb.Attribute;
  /**
   * Optional vendor tag for the table
   */
  vendorTag?: string;
}

//
//
// Main
//

/**
 * DynamoDB table with Jaypie single-table design patterns.
 *
 * Creates a table with:
 * - Partition key: `model` (String)
 * - Sort key: `id` (String)
 * - Billing: PAY_PER_REQUEST (on-demand)
 * - Removal policy: RETAIN in production, DESTROY otherwise
 * - Five GSIs for different access patterns (can be overridden)
 *
 * @example
 * // Shorthand: tableName becomes "myApp", construct id is "JaypieDynamoDb-myApp"
 * const table = new JaypieDynamoDb(this, "myApp");
 *
 * @example
 * // Full configuration
 * const table = new JaypieDynamoDb(this, "MyTable", {
 *   tableName: "custom-table-name",
 *   globalSecondaryIndexes: [], // Disable GSIs
 * });
 *
 * @example
 * // Use only specific GSIs
 * const table = new JaypieDynamoDb(this, "MyTable", {
 *   globalSecondaryIndexes: [
 *     JaypieDynamoDb.GlobalSecondaryIndex.Scope,
 *     JaypieDynamoDb.GlobalSecondaryIndex.Type,
 *   ],
 * });
 */
export class JaypieDynamoDb extends Construct implements dynamodb.ITableV2 {
  /**
   * Individual GSI definitions for Jaypie single-table design
   */
  public static readonly GlobalSecondaryIndex = GlobalSecondaryIndex;

  /**
   * Array of all default Jaypie GSI definitions
   */
  public static readonly GlobalSecondaryIndexes = GlobalSecondaryIndexes;

  private readonly _table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: JaypieDynamoDbProps = {}) {
    // Determine if this is shorthand usage: new JaypieDynamoDb(this, "myApp")
    // In shorthand, id becomes the tableName and construct id is prefixed
    const isShorthand = !props.tableName && !id.includes("-");
    const constructId = isShorthand ? `JaypieDynamoDb-${id}` : id;
    const tableName = props.tableName ?? (isShorthand ? id : undefined);

    super(scope, constructId);

    const {
      billing = dynamodb.Billing.onDemand(),
      globalSecondaryIndexes: gsiInput,
      partitionKey = {
        name: "model",
        type: dynamodb.AttributeType.STRING,
      },
      project,
      removalPolicy = isProductionEnv()
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
      roleTag = CDK.ROLE.STORAGE,
      service,
      sortKey = { name: "id", type: dynamodb.AttributeType.STRING },
      vendorTag,
      ...restProps
    } = props;

    // Resolve GSI configuration: undefined/true = all, false = none, array = use as-is
    const globalSecondaryIndexes =
      gsiInput === false
        ? undefined
        : Array.isArray(gsiInput)
          ? gsiInput
          : GlobalSecondaryIndexes;

    this._table = new dynamodb.TableV2(this, "Table", {
      billing,
      globalSecondaryIndexes,
      partitionKey,
      removalPolicy,
      sortKey,
      tableName,
      ...restProps,
    });

    // Apply tags
    if (project) {
      Tags.of(this._table).add(CDK.TAG.PROJECT, project);
    }
    Tags.of(this._table).add(CDK.TAG.ROLE, roleTag);
    if (service) {
      Tags.of(this._table).add(CDK.TAG.SERVICE, service);
    }
    if (vendorTag) {
      Tags.of(this._table).add(CDK.TAG.VENDOR, vendorTag);
    }
  }

  //
  //
  // Public accessors
  //

  /**
   * The underlying DynamoDB TableV2 construct
   */
  public get table(): dynamodb.TableV2 {
    return this._table;
  }

  //
  //
  // ITableV2 implementation
  //

  public get env() {
    return this._table.env;
  }

  public get stack() {
    return this._table.stack;
  }

  public get tableArn(): string {
    return this._table.tableArn;
  }

  public get tableId(): string | undefined {
    return this._table.tableId;
  }

  public get tableName(): string {
    return this._table.tableName;
  }

  public get tableStreamArn(): string | undefined {
    return this._table.tableStreamArn;
  }

  public get encryptionKey(): import("aws-cdk-lib/aws-kms").IKey | undefined {
    return this._table.encryptionKey;
  }

  public applyRemovalPolicy(policy: RemovalPolicy): void {
    this._table.applyRemovalPolicy(policy);
  }

  public grant(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
    ...actions: string[]
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._table.grant(grantee, ...actions);
  }

  public grantFullAccess(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._table.grantFullAccess(grantee);
  }

  public grantReadData(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._table.grantReadData(grantee);
  }

  public grantReadWriteData(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._table.grantReadWriteData(grantee);
  }

  public grantStream(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
    ...actions: string[]
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._table.grantStream(grantee, ...actions);
  }

  public grantStreamRead(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._table.grantStreamRead(grantee);
  }

  public grantTableListStreams(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._table.grantTableListStreams(grantee);
  }

  public grantWriteData(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._table.grantWriteData(grantee);
  }

  public metric(
    metricName: string,
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._table.metric(metricName, props);
  }

  public metricConditionalCheckFailedRequests(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._table.metricConditionalCheckFailedRequests(props);
  }

  public metricConsumedReadCapacityUnits(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._table.metricConsumedReadCapacityUnits(props);
  }

  public metricConsumedWriteCapacityUnits(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._table.metricConsumedWriteCapacityUnits(props);
  }

  public metricSuccessfulRequestLatency(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._table.metricSuccessfulRequestLatency(props);
  }

  public metricSystemErrorsForOperations(
    props?: dynamodb.SystemErrorsForOperationsMetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").IMetric {
    return this._table.metricSystemErrorsForOperations(props);
  }

  public metricThrottledRequests(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._table.metricThrottledRequests(props);
  }

  public metricThrottledRequestsForOperations(
    props?: dynamodb.OperationsMetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").IMetric {
    return this._table.metricThrottledRequestsForOperations(props);
  }

  public metricUserErrors(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._table.metricUserErrors(props);
  }
}

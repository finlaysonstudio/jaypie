import { Construct } from "constructs";
import { RemovalPolicy, Tags } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import {
  DEFAULT_SORT_KEY,
  generateIndexName,
  type IndexDefinition,
} from "@jaypie/fabric";

import { CDK } from "./constants";
import { isProductionEnv } from "./helpers/isEnv";

//
//
// Constants
//

/** Composite key separator used in GSI partition keys */
const SEPARATOR = "#";

//
//
// Helper Functions
//

/**
 * Convert IndexDefinition[] from @jaypie/fabric to CDK GlobalSecondaryIndexPropsV2[]
 *
 * @param indexes - Array of IndexDefinition from @jaypie/fabric
 * @returns Array of CDK GlobalSecondaryIndexPropsV2
 */
function indexesToGsi(
  indexes: IndexDefinition[],
): dynamodb.GlobalSecondaryIndexPropsV2[] {
  return indexes.map((index) => {
    // Generate index name from pk fields if not provided
    const indexName = index.name ?? generateIndexName(index.pk);

    // Sort key defaults to ["sequence"] if not provided
    const skFields = index.sk ?? DEFAULT_SORT_KEY;

    return {
      indexName,
      partitionKey: {
        name: indexName,
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
      sortKey:
        skFields.length === 1 && skFields[0] === "sequence"
          ? { name: "sequence", type: dynamodb.AttributeType.NUMBER }
          : {
              name: skFields.join(SEPARATOR),
              type: dynamodb.AttributeType.STRING,
            },
    };
  });
}

//
//
// Types
//

export interface JaypieDynamoDbProps extends Omit<
  dynamodb.TablePropsV2,
  "globalSecondaryIndexes" | "partitionKey" | "sortKey"
> {
  /**
   * Configure GSIs for the table using @jaypie/fabric IndexDefinition format.
   * - `undefined`: No GSIs (default)
   * - Array of IndexDefinition: Use the specified indexes
   *
   * Import `DEFAULT_INDEXES` from `@jaypie/fabric` for the standard Jaypie GSIs.
   *
   * @example
   * // No GSIs (default)
   * new JaypieDynamoDb(this, "myTable");
   *
   * @example
   * // With default Jaypie indexes
   * import { DEFAULT_INDEXES } from "@jaypie/fabric";
   * new JaypieDynamoDb(this, "myTable", {
   *   indexes: DEFAULT_INDEXES,
   * });
   *
   * @example
   * // With custom indexes
   * new JaypieDynamoDb(this, "myTable", {
   *   indexes: [
   *     { pk: ["scope", "model"], sk: ["sequence"] },
   *     { pk: ["scope", "model", "type"], sk: ["sequence"], sparse: true },
   *   ],
   * });
   */
  indexes?: IndexDefinition[];
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
 * - No GSIs by default (use `indexes` prop to add them)
 * - Table name: CDK-generated (includes stack name and unique suffix)
 *
 * @example
 * // Shorthand: construct id is "JaypieDynamoDb-myApp", table name is CDK-generated
 * const table = new JaypieDynamoDb(this, "myApp");
 *
 * @example
 * // With default Jaypie indexes
 * import { DEFAULT_INDEXES } from "@jaypie/fabric";
 * const table = new JaypieDynamoDb(this, "myApp", {
 *   indexes: DEFAULT_INDEXES,
 * });
 *
 * @example
 * // With explicit table name (overrides CDK-generated name)
 * const table = new JaypieDynamoDb(this, "MyTable", {
 *   tableName: "custom-table-name",
 *   indexes: [
 *     { pk: ["scope", "model"] },
 *     { pk: ["scope", "model", "type"], sparse: true },
 *   ],
 * });
 */
export class JaypieDynamoDb extends Construct implements dynamodb.ITableV2 {
  private readonly _table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: JaypieDynamoDbProps = {}) {
    // Determine if this is shorthand usage: new JaypieDynamoDb(this, "myApp")
    // In shorthand, construct id is prefixed for clarity; tableName left undefined
    // so CDK generates it with stack prefix (e.g., cdk-sponsor-project-env-nonce-app-JaypieDynamoDb-myApp-Table-XXXXX)
    const isShorthand = !props.tableName && !id.includes("-");
    const constructId = isShorthand ? `JaypieDynamoDb-${id}` : id;

    super(scope, constructId);

    const {
      billing = dynamodb.Billing.onDemand(),
      indexes,
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

    // Convert IndexDefinition[] to CDK GSI props
    const globalSecondaryIndexes = indexes ? indexesToGsi(indexes) : undefined;

    this._table = new dynamodb.TableV2(this, "Table", {
      billing,
      globalSecondaryIndexes,
      partitionKey,
      removalPolicy,
      sortKey,
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

  public get tableRef(): dynamodb.TableReference {
    return this._table.tableRef;
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

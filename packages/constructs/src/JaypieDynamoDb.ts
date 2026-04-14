import { Construct } from "constructs";
import { RemovalPolicy, Tags } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import { CDK } from "./constants";
import { isProductionEnv } from "./helpers/isEnv";
import type { IndexDefinition } from "./types/IndexDefinition";

//
//
// Helper Functions
//

/**
 * Derive GSI attribute names for an index definition.
 *
 * Mirrors `@jaypie/fabric`'s `getGsiAttributeNames` so CDK provisioning and
 * any runtime write path agree on the attribute names. Kept local to avoid
 * a runtime dependency on the pre-1.0 `@jaypie/fabric` package.
 *
 * - `pk` is always the index name (`index.name` or generated from `index.pk`)
 * - `sk` is the single sk field name when `sk.length === 1`, or
 *   `{indexName}Sk` when `sk.length > 1` (composite sk attribute)
 */
function getGsiAttributeNames(index: IndexDefinition): {
  pk: string;
  sk: string | undefined;
} {
  const name = index.name ?? generateIndexName(index.pk);
  let sk: string | undefined;
  if (index.sk && index.sk.length > 1) {
    sk = `${name}Sk`;
  } else if (index.sk && index.sk.length === 1) {
    sk = index.sk[0];
  }
  return { pk: name, sk };
}

function generateIndexName(pk: string[]): string {
  const suffix = pk
    .map((field) => field.charAt(0).toUpperCase() + field.slice(1))
    .join("");
  return `index${suffix}`;
}

/**
 * Convert IndexDefinition[] to CDK GlobalSecondaryIndexPropsV2[].
 *
 * Composite sk indexes (sk.length > 1) get a dedicated STRING `{indexName}Sk`
 * attribute; single-field sk indexes reference the field directly (STRING in
 * the general case, NUMBER for the legacy `sequence` name).
 */
function indexesToGsi(
  indexes: IndexDefinition[],
): dynamodb.GlobalSecondaryIndexPropsV2[] {
  return indexes.map((index) => {
    const { pk, sk } = getGsiAttributeNames(index);

    let sortKey: dynamodb.Attribute | undefined;
    if (sk) {
      if (sk === "sequence") {
        sortKey = { name: "sequence", type: dynamodb.AttributeType.NUMBER };
      } else {
        sortKey = { name: sk, type: dynamodb.AttributeType.STRING };
      }
    }

    return {
      indexName: pk,
      partitionKey: {
        name: pk,
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
      ...(sortKey && { sortKey }),
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
   * Configure GSIs for the table using the IndexDefinition format.
   * - `undefined`: No GSIs (default)
   * - Array of IndexDefinition: Use the specified indexes
   *
   * @example
   * // No GSIs (default)
   * new JaypieDynamoDb(this, "myTable");
   *
   * @example
   * // Inline indexes
   * new JaypieDynamoDb(this, "myTable", {
   *   indexes: [
   *     { name: "indexModel", pk: ["model"], sk: ["scope", "updatedAt"] },
   *     { name: "indexModelAlias", pk: ["model", "alias"], sk: ["scope", "updatedAt"], sparse: true },
   *   ],
   * });
   */
  indexes?: IndexDefinition[];
  /**
   * Partition key attribute definition.
   * @default { name: "id", type: AttributeType.STRING }
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
   * Sort key attribute definition. Defaults to `undefined` (no sort key) —
   * the Jaypie single-table pattern uses `id` as a unique partition key.
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
 * - Partition key: `id` (String), no sort key
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
 * // With inline IndexDefinition for GSIs
 * const table = new JaypieDynamoDb(this, "MyTable", {
 *   tableName: "custom-table-name",
 *   indexes: [
 *     { name: "indexModel", pk: ["model"], sk: ["scope", "updatedAt"] },
 *     { name: "indexModelAlias", pk: ["model", "alias"], sk: ["scope", "updatedAt"], sparse: true },
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
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      project,
      removalPolicy = isProductionEnv()
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
      roleTag = CDK.ROLE.STORAGE,
      service,
      sortKey,
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
      ...(sortKey && { sortKey }),
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

  public get grants(): dynamodb.TableGrants {
    return this._table.grants;
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

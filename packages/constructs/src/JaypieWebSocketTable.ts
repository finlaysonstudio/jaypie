import { Construct } from "constructs";
import { Duration, RemovalPolicy, Tags } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";

import { CDK } from "./constants";
import { constructEnvName } from "./helpers";

//
//
// Types
//

export interface JaypieWebSocketTableProps {
  /**
   * Explicit table name. If not provided, uses CDK-generated name.
   */
  tableName?: string;

  /**
   * Time-to-live duration for connections.
   * Connections will be automatically deleted after this duration.
   * @default Duration.hours(24)
   */
  ttl?: Duration;

  /**
   * Whether to create a GSI for looking up connections by user ID.
   * @default false
   */
  userIndex?: boolean;

  /**
   * Role tag for tagging resources.
   * @default CDK.ROLE.STORAGE
   */
  roleTag?: string;
}

//
//
// Main
//

/**
 * JaypieWebSocketTable - DynamoDB table for storing WebSocket connection IDs.
 *
 * Provides a simple table structure for tracking active WebSocket connections:
 * - Partition key: connectionId (String)
 * - TTL attribute: expiresAt (for automatic cleanup)
 * - Optional GSI: userId-index (for looking up connections by user)
 *
 * @example
 * ```typescript
 * const connectionTable = new JaypieWebSocketTable(this, "Connections");
 *
 * const ws = new JaypieWebSocket(this, "Chat", {
 *   host: "ws.example.com",
 *   handler: chatHandler,
 * });
 *
 * // Grant Lambda access to the table
 * connectionTable.grantReadWriteData(chatHandler);
 *
 * // Pass table name to Lambda
 * chatHandler.addEnvironment("CONNECTION_TABLE", connectionTable.tableName);
 * ```
 *
 * @example
 * // With user index for looking up all connections for a user
 * const connectionTable = new JaypieWebSocketTable(this, "Connections", {
 *   userIndex: true,
 *   ttl: Duration.hours(12),
 * });
 */
export class JaypieWebSocketTable extends Construct {
  private readonly _table: dynamodb.TableV2;
  private readonly _ttlDuration: Duration;

  constructor(
    scope: Construct,
    id: string,
    props: JaypieWebSocketTableProps = {},
  ) {
    super(scope, id);

    const {
      roleTag = CDK.ROLE.STORAGE,
      tableName,
      ttl = Duration.hours(24),
      userIndex = false,
    } = props;

    this._ttlDuration = ttl;

    // Build global secondary indexes
    const globalSecondaryIndexes: dynamodb.GlobalSecondaryIndexPropsV2[] = [];

    if (userIndex) {
      globalSecondaryIndexes.push({
        indexName: "userId-index",
        partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
        sortKey: { name: "connectedAt", type: dynamodb.AttributeType.STRING },
      });
    }

    // Create the table
    this._table = new dynamodb.TableV2(this, "Table", {
      billing: dynamodb.Billing.onDemand(),
      globalSecondaryIndexes:
        globalSecondaryIndexes.length > 0 ? globalSecondaryIndexes : undefined,
      partitionKey: {
        name: "connectionId",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: tableName || constructEnvName("WebSocketConnections"),
      timeToLiveAttribute: "expiresAt",
    });

    Tags.of(this._table).add(CDK.TAG.ROLE, roleTag);
  }

  //
  //
  // Public accessors
  //

  /**
   * The underlying DynamoDB TableV2 construct.
   */
  public get table(): dynamodb.TableV2 {
    return this._table;
  }

  /**
   * The name of the DynamoDB table.
   */
  public get tableName(): string {
    return this._table.tableName;
  }

  /**
   * The ARN of the DynamoDB table.
   */
  public get tableArn(): string {
    return this._table.tableArn;
  }

  /**
   * TTL duration for connections in seconds.
   * Use this to calculate expiresAt when storing connections.
   */
  public get ttlSeconds(): number {
    return this._ttlDuration.toSeconds();
  }

  //
  //
  // Grant methods
  //

  /**
   * Grant read permissions to the table.
   */
  public grantReadData(grantee: iam.IGrantable): iam.Grant {
    return this._table.grantReadData(grantee);
  }

  /**
   * Grant write permissions to the table.
   */
  public grantWriteData(grantee: iam.IGrantable): iam.Grant {
    return this._table.grantWriteData(grantee);
  }

  /**
   * Grant read and write permissions to the table.
   */
  public grantReadWriteData(grantee: iam.IGrantable): iam.Grant {
    return this._table.grantReadWriteData(grantee);
  }

  //
  //
  // Convenience methods
  //

  /**
   * Add the table name to a Lambda function's environment variables.
   * Also grants read/write access to the table.
   */
  public connectLambda(
    lambdaFunction: lambda.IFunction,
    options: { envKey?: string; readOnly?: boolean } = {},
  ): void {
    const { envKey = "CONNECTION_TABLE", readOnly = false } = options;

    // Add environment variable
    if ("addEnvironment" in lambdaFunction) {
      (lambdaFunction as lambda.Function).addEnvironment(
        envKey,
        this.tableName,
      );
    }

    // Grant permissions
    if (readOnly) {
      this.grantReadData(lambdaFunction.grantPrincipal);
    } else {
      this.grantReadWriteData(lambdaFunction.grantPrincipal);
    }
  }
}

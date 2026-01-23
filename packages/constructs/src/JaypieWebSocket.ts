import { Construct } from "constructs";
import { ArnFormat, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";

import { CDK } from "./constants";
import {
  constructEnvName,
  envHostname,
  HostConfig,
  mergeDomain,
  resolveCertificate,
  resolveHostedZone,
} from "./helpers";

//
//
// Types
//

export interface JaypieWebSocketProps {
  /**
   * Certificate configuration.
   * - true: Create certificate at stack level (default, reusable)
   * - false: No certificate (use regional endpoint)
   * - ICertificate: Use provided certificate
   * - string: Import certificate from ARN
   */
  certificate?: boolean | acm.ICertificate | string;

  /**
   * Lambda handler for $connect route (connection established).
   * Use this to validate connections (e.g., auth tokens) and store connection IDs.
   */
  connect?: lambda.IFunction;

  /**
   * Lambda handler for $default route (catches unmatched messages).
   * Use this as the main message handler.
   */
  default?: lambda.IFunction;

  /**
   * Lambda handler for $disconnect route (connection closed).
   * Use this to clean up connection IDs from storage.
   */
  disconnect?: lambda.IFunction;

  /**
   * Single Lambda handler for all routes.
   * Alternative to providing separate connect/disconnect/default handlers.
   * The handler receives routeKey in the context to determine which route was invoked.
   */
  handler?: lambda.IFunction;

  /**
   * The domain name for the WebSocket API.
   *
   * Supports both string and config object:
   * - String: used directly as the domain name (e.g., "ws.example.com")
   * - Object: passed to envHostname() to construct the domain name
   *   - { subdomain, domain, env, component }
   *
   * @example
   * // Direct string
   * host: "ws.example.com"
   *
   * @example
   * // Config object - resolves using envHostname()
   * host: { component: "ws" }
   */
  host?: string | HostConfig;

  /**
   * Log retention for WebSocket API access logs.
   * @default logs.RetentionDays.THREE_MONTHS
   */
  logRetention?: logs.RetentionDays;

  /**
   * Construct name (used for resource naming).
   */
  name?: string;

  /**
   * Role tag for tagging resources.
   * @default CDK.ROLE.API
   */
  roleTag?: string;

  /**
   * Additional named routes beyond $connect, $disconnect, and $default.
   * Keys are route keys (e.g., "sendMessage", "subscribe").
   */
  routes?: Record<string, lambda.IFunction>;

  /**
   * Stage name for the WebSocket API.
   * @default "production"
   */
  stageName?: string;

  /**
   * Route53 hosted zone for DNS records.
   * - string: Zone domain name (looked up or imported)
   * - IHostedZone: Use provided hosted zone
   */
  zone?: string | route53.IHostedZone;
}

//
//
// Main
//

export class JaypieWebSocket extends Construct {
  private readonly _api: apigatewayv2.WebSocketApi;
  private readonly _certificate?: acm.ICertificate;
  private readonly _domainName?: apigatewayv2.DomainName;
  private readonly _host?: string;
  private readonly _stage: apigatewayv2.WebSocketStage;

  constructor(scope: Construct, id: string, props: JaypieWebSocketProps = {}) {
    super(scope, id);

    const {
      certificate = true,
      connect,
      default: defaultHandler,
      disconnect,
      handler,
      host: propsHost,
      logRetention = logs.RetentionDays.THREE_MONTHS,
      name,
      roleTag = CDK.ROLE.API,
      routes = {},
      stageName = "production",
      zone: propsZone,
    } = props;

    // Validate: either handler OR individual handlers, not both
    const hasIndividualHandlers = connect || disconnect || defaultHandler;
    if (handler && hasIndividualHandlers) {
      throw new Error(
        "Cannot specify both 'handler' and individual route handlers (connect/disconnect/default)",
      );
    }

    // Determine zone from props or environment
    let zone = propsZone;
    if (!zone && process.env.CDK_ENV_HOSTED_ZONE) {
      zone = process.env.CDK_ENV_HOSTED_ZONE;
    }

    // Determine host from props or environment
    let host: string | undefined;
    if (typeof propsHost === "string") {
      host = propsHost;
    } else if (typeof propsHost === "object") {
      // Resolve host from HostConfig using envHostname()
      host = envHostname(propsHost);
    } else if (process.env.CDK_ENV_WS_HOST_NAME) {
      host = process.env.CDK_ENV_WS_HOST_NAME;
    } else if (
      process.env.CDK_ENV_WS_SUBDOMAIN &&
      process.env.CDK_ENV_HOSTED_ZONE
    ) {
      host = mergeDomain(
        process.env.CDK_ENV_WS_SUBDOMAIN,
        process.env.CDK_ENV_HOSTED_ZONE,
      );
    }

    const apiName = name || constructEnvName("WebSocket");

    // Create WebSocket API
    this._api = new apigatewayv2.WebSocketApi(this, "Api", {
      apiName,
    });
    Tags.of(this._api).add(CDK.TAG.ROLE, roleTag);

    // Add routes with Lambda integrations
    const connectHandler = handler || connect;
    const disconnectHandler = handler || disconnect;
    const defaultRouteHandler = handler || defaultHandler;

    if (connectHandler) {
      this._api.addRoute("$connect", {
        integration: new apigatewayv2Integrations.WebSocketLambdaIntegration(
          "ConnectIntegration",
          connectHandler,
        ),
      });
    }

    if (disconnectHandler) {
      this._api.addRoute("$disconnect", {
        integration: new apigatewayv2Integrations.WebSocketLambdaIntegration(
          "DisconnectIntegration",
          disconnectHandler,
        ),
      });
    }

    if (defaultRouteHandler) {
      this._api.addRoute("$default", {
        integration: new apigatewayv2Integrations.WebSocketLambdaIntegration(
          "DefaultIntegration",
          defaultRouteHandler,
        ),
      });
    }

    // Add custom routes
    for (const [routeKey, routeHandler] of Object.entries(routes)) {
      this._api.addRoute(routeKey, {
        integration: new apigatewayv2Integrations.WebSocketLambdaIntegration(
          `${routeKey}Integration`,
          routeHandler,
        ),
      });
    }

    // Create log group for access logs
    // Note: logGroup is created for future use when API Gateway v2 WebSocket
    // access logging is fully supported in CDK
    new logs.LogGroup(this, "AccessLogs", {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logRetention,
    });

    // Create stage
    this._stage = new apigatewayv2.WebSocketStage(this, "Stage", {
      autoDeploy: true,
      stageName,
      webSocketApi: this._api,
    });
    Tags.of(this._stage).add(CDK.TAG.ROLE, roleTag);

    // Set up custom domain if host and zone are provided
    let hostedZone: route53.IHostedZone | undefined;
    let certificateToUse: acm.ICertificate | undefined;

    if (host && zone) {
      hostedZone = resolveHostedZone(this, { zone });

      // Use resolveCertificate to create certificate at stack level (enables reuse)
      certificateToUse = resolveCertificate(this, {
        certificate,
        domainName: host,
        roleTag: CDK.ROLE.HOSTING,
        zone: hostedZone,
      });

      this._certificate = certificateToUse;
      this._host = host;

      if (certificateToUse) {
        // Create custom domain
        this._domainName = new apigatewayv2.DomainName(this, "DomainName", {
          certificate: certificateToUse,
          domainName: host,
        });
        Tags.of(this._domainName).add(CDK.TAG.ROLE, roleTag);

        // Map domain to stage
        new apigatewayv2.ApiMapping(this, "ApiMapping", {
          api: this._api,
          domainName: this._domainName,
          stage: this._stage,
        });

        // Create DNS record
        new route53.ARecord(this, "AliasRecord", {
          recordName: host,
          target: route53.RecordTarget.fromAlias(
            new route53Targets.ApiGatewayv2DomainProperties(
              this._domainName.regionalDomainName,
              this._domainName.regionalHostedZoneId,
            ),
          ),
          zone: hostedZone,
        });

        // Also create AAAA record for IPv6
        new route53.AaaaRecord(this, "AaaaAliasRecord", {
          recordName: host,
          target: route53.RecordTarget.fromAlias(
            new route53Targets.ApiGatewayv2DomainProperties(
              this._domainName.regionalDomainName,
              this._domainName.regionalHostedZoneId,
            ),
          ),
          zone: hostedZone,
        });
      }
    }

    // Grant all handlers permission to manage connections
    const allHandlers = new Set<lambda.IFunction>();
    if (connectHandler) allHandlers.add(connectHandler);
    if (disconnectHandler) allHandlers.add(disconnectHandler);
    if (defaultRouteHandler) allHandlers.add(defaultRouteHandler);
    Object.values(routes).forEach((h) => allHandlers.add(h));

    for (const lambdaHandler of allHandlers) {
      this.grantManageConnections(lambdaHandler);
    }
  }

  //
  //
  // Public accessors
  //

  public get api(): apigatewayv2.WebSocketApi {
    return this._api;
  }

  public get apiId(): string {
    return this._api.apiId;
  }

  public get certificate(): acm.ICertificate | undefined {
    return this._certificate;
  }

  public get domainName(): string | undefined {
    return this._domainName?.name;
  }

  /**
   * The WebSocket endpoint URL.
   * Uses custom domain if configured, otherwise returns the default stage URL.
   */
  public get endpoint(): string {
    if (this._host) {
      return `wss://${this._host}`;
    }
    return this._stage.url;
  }

  public get host(): string | undefined {
    return this._host;
  }

  public get stage(): apigatewayv2.WebSocketStage {
    return this._stage;
  }

  /**
   * The callback URL for API Gateway Management API.
   * Use this URL to send messages to connected clients.
   */
  public get callbackUrl(): string {
    if (this._host) {
      return `https://${this._host}`;
    }
    // Extract callback URL from stage URL
    // Stage URL: wss://abc123.execute-api.us-east-1.amazonaws.com/production
    // Callback URL: https://abc123.execute-api.us-east-1.amazonaws.com/production
    return this._stage.url.replace("wss://", "https://");
  }

  //
  //
  // Public methods
  //

  /**
   * Grant a Lambda function permission to manage WebSocket connections
   * (post to connections, delete connections).
   */
  public grantManageConnections(grantee: lambda.IFunction): iam.Grant {
    return iam.Grant.addToPrincipal({
      actions: ["execute-api:ManageConnections"],
      grantee: grantee.grantPrincipal,
      resourceArns: [
        Stack.of(this).formatArn({
          arnFormat: ArnFormat.SLASH_RESOURCE_SLASH_RESOURCE_NAME,
          resource: this._api.apiId,
          resourceName: `${this._stage.stageName}/*`,
          service: "execute-api",
        }),
      ],
    });
  }
}

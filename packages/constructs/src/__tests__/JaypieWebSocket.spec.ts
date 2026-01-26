import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Template } from "aws-cdk-lib/assertions";

// Subject
import { JaypieWebSocket } from "../JaypieWebSocket";
import { JaypieWebSocketLambda } from "../JaypieWebSocketLambda";
import { JaypieWebSocketTable } from "../JaypieWebSocketTable";

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = {
    ...DEFAULT_ENV,
    PROJECT_ENV: "test",
    PROJECT_KEY: "test-project",
    PROJECT_SPONSOR: "test-sponsor",
    PROJECT_NONCE: "abc123",
  };
  vi.clearAllMocks();
});

//
//
// Helper functions
//

function createTestStack(): cdk.Stack {
  const app = new cdk.App();
  return new cdk.Stack(app, "TestStack", {
    env: { account: "123456789012", region: "us-east-1" },
  });
}

function createTestLambda(stack: cdk.Stack, id: string): lambda.Function {
  return new lambda.Function(stack, id, {
    code: lambda.Code.fromInline("exports.handler = () => {}"),
    handler: "index.handler",
    runtime: lambda.Runtime.NODEJS_20_X,
  });
}

//
//
// Run tests
//

describe("JaypieWebSocket", () => {
  describe("Base Cases", () => {
    it("Works", () => {
      expect(JaypieWebSocket).toBeDefined();
    });

    it("Creates a WebSocket API with minimal configuration", () => {
      const stack = createTestStack();
      const handler = createTestLambda(stack, "Handler");

      new JaypieWebSocket(stack, "TestWs", {
        handler,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
        ProtocolType: "WEBSOCKET",
      });
    });
  });

  describe("Route Configuration", () => {
    it("Creates routes for connect, disconnect, and default handlers", () => {
      const stack = createTestStack();
      const connectHandler = createTestLambda(stack, "Connect");
      const disconnectHandler = createTestLambda(stack, "Disconnect");
      const defaultHandler = createTestLambda(stack, "Default");

      new JaypieWebSocket(stack, "TestWs", {
        connect: connectHandler,
        default: defaultHandler,
        disconnect: disconnectHandler,
      });

      const template = Template.fromStack(stack);

      // Check that routes are created
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey: "$connect",
      });
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey: "$disconnect",
      });
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey: "$default",
      });
    });

    it("Creates custom routes", () => {
      const stack = createTestStack();
      const handler = createTestLambda(stack, "Handler");
      const sendMessageHandler = createTestLambda(stack, "SendMessage");

      new JaypieWebSocket(stack, "TestWs", {
        handler,
        routes: {
          sendMessage: sendMessageHandler,
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey: "sendMessage",
      });
    });

    it("Throws if both handler and individual handlers are provided", () => {
      const stack = createTestStack();
      const handler = createTestLambda(stack, "Handler");
      const connectHandler = createTestLambda(stack, "Connect");

      expect(() => {
        new JaypieWebSocket(stack, "TestWs", {
          connect: connectHandler,
          handler,
        });
      }).toThrow();
    });
  });

  describe("Stage Configuration", () => {
    it("Creates a stage with auto-deploy", () => {
      const stack = createTestStack();
      const handler = createTestLambda(stack, "Handler");

      new JaypieWebSocket(stack, "TestWs", {
        handler,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
        AutoDeploy: true,
        StageName: "production",
      });
    });

    it("Uses custom stage name", () => {
      const stack = createTestStack();
      const handler = createTestLambda(stack, "Handler");

      new JaypieWebSocket(stack, "TestWs", {
        handler,
        stageName: "v1",
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
        StageName: "v1",
      });
    });
  });

  describe("Accessors", () => {
    it("Provides endpoint URL", () => {
      const stack = createTestStack();
      const handler = createTestLambda(stack, "Handler");

      const ws = new JaypieWebSocket(stack, "TestWs", {
        handler,
      });

      expect(ws.endpoint).toBeDefined();
      expect(ws.api).toBeDefined();
      expect(ws.stage).toBeDefined();
    });

    it("Provides callback URL", () => {
      const stack = createTestStack();
      const handler = createTestLambda(stack, "Handler");

      const ws = new JaypieWebSocket(stack, "TestWs", {
        handler,
      });

      expect(ws.callbackUrl).toBeDefined();
    });
  });

  describe("grantManageConnections", () => {
    it("Grants execute-api:ManageConnections with @connections path for all methods", () => {
      const stack = createTestStack();
      const handler = createTestLambda(stack, "Handler");

      new JaypieWebSocket(stack, "TestWs", {
        handler,
      });

      const template = Template.fromStack(stack);
      const policies = template.findResources("AWS::IAM::Policy");
      const policyResource = Object.values(policies)[0];
      const statement = policyResource.Properties.PolicyDocument.Statement[0];

      expect(statement.Action).toBe("execute-api:ManageConnections");
      expect(statement.Effect).toBe("Allow");

      // Verify the ARN includes @connections path for all stages and methods
      // CDK's grantManageConnections uses: arn:...:api-id/*/*/@connections/*
      // (first /* for stage, second /* for method)
      const resourceArn = statement.Resource["Fn::Join"][1];
      const arnSuffix = resourceArn[resourceArn.length - 1];
      expect(arnSuffix).toBe("/*/*/@connections/*");
    });
  });
});

describe("JaypieWebSocketLambda", () => {
  describe("Base Cases", () => {
    it("Works", () => {
      expect(JaypieWebSocketLambda).toBeDefined();
    });

    it("Creates a Lambda function", () => {
      const stack = createTestStack();

      new JaypieWebSocketLambda(stack, "Handler", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
      });
    });
  });
});

describe("JaypieWebSocketTable", () => {
  describe("Base Cases", () => {
    it("Works", () => {
      expect(JaypieWebSocketTable).toBeDefined();
    });

    it("Creates a DynamoDB table", () => {
      const stack = createTestStack();

      new JaypieWebSocketTable(stack, "Connections");

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        KeySchema: [
          {
            AttributeName: "connectionId",
            KeyType: "HASH",
          },
        ],
        TimeToLiveSpecification: {
          AttributeName: "expiresAt",
          Enabled: true,
        },
      });
    });
  });

  describe("Configuration", () => {
    it("Creates user index when specified", () => {
      const stack = createTestStack();

      new JaypieWebSocketTable(stack, "Connections", {
        userIndex: true,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        GlobalSecondaryIndexes: [
          {
            IndexName: "userId-index",
            KeySchema: [
              { AttributeName: "userId", KeyType: "HASH" },
              { AttributeName: "connectedAt", KeyType: "RANGE" },
            ],
          },
        ],
      });
    });

    it("Provides TTL seconds", () => {
      const stack = createTestStack();

      const table = new JaypieWebSocketTable(stack, "Connections");

      // Default is 24 hours
      expect(table.ttlSeconds).toBe(86400);
    });

    it("Uses custom TTL", () => {
      const stack = createTestStack();

      const table = new JaypieWebSocketTable(stack, "Connections", {
        ttl: cdk.Duration.hours(12),
      });

      expect(table.ttlSeconds).toBe(43200);
    });
  });

  describe("Methods", () => {
    it("Grants read/write data", () => {
      const stack = createTestStack();
      const table = new JaypieWebSocketTable(stack, "Connections");
      const handler = createTestLambda(stack, "Handler");

      table.grantReadWriteData(handler);

      const template = Template.fromStack(stack);
      // Verify IAM policy is created for the Lambda
      template.resourceCountIs("AWS::IAM::Policy", 1);
    });

    it("Connects Lambda with environment and permissions", () => {
      const stack = createTestStack();
      const table = new JaypieWebSocketTable(stack, "Connections");
      const handler = createTestLambda(stack, "Handler");

      table.connectLambda(handler);

      // Verify the environment variable key is set (table name is a token)
      const template = Template.fromStack(stack);
      const resources = template.findResources("AWS::Lambda::Function");
      const lambdaResource = Object.values(resources)[0];
      expect(
        lambdaResource.Properties.Environment.Variables.CONNECTION_TABLE,
      ).toBeDefined();
    });
  });
});

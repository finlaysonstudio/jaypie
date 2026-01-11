import { serviceHandler } from "@jaypie/vocabulary";

const DEFAULT_ADMIN_PORT = 8001;
const DEFAULT_DYNAMODB_PORT = 8000;
const DEFAULT_PROJECT_NAME = "jaypie";
const DEFAULT_TABLE_NAME = "jaypie-local";

/**
 * Generate docker-compose.yml for local DynamoDB development
 */
export const dockerComposeHandler = serviceHandler({
  alias: "dynamodb_generate_docker_compose",
  description: "Generate docker-compose.yml for local DynamoDB development",
  input: {
    adminPort: {
      type: Number,
      default: DEFAULT_ADMIN_PORT,
      description: "Port for DynamoDB Admin UI",
    },
    dynamodbPort: {
      type: Number,
      default: DEFAULT_DYNAMODB_PORT,
      description: "Port for DynamoDB Local",
    },
    projectName: {
      type: String,
      default: DEFAULT_PROJECT_NAME,
      description: "Project name for container naming",
    },
    tableName: {
      type: String,
      default: DEFAULT_TABLE_NAME,
      description: "Default table name",
    },
  },
  service: async ({ adminPort, dynamodbPort, projectName, tableName }) => {
    const dockerCompose = `name: ${projectName}-dynamodb-stack

services:
  dynamodb:
    image: amazon/dynamodb-local:latest
    container_name: ${projectName}-dynamodb
    command: "-jar DynamoDBLocal.jar -sharedDb -dbPath /data"
    ports:
      - "${dynamodbPort}:8000"
    working_dir: /home/dynamodblocal
    volumes:
      - dynamodb_data:/data
    user: "0:0"

  dynamodb-admin:
    image: aaronshaf/dynamodb-admin:latest
    container_name: ${projectName}-dynamodb-admin
    ports:
      - "${adminPort}:8001"
    environment:
      - DYNAMO_ENDPOINT=http://dynamodb:8000
      - AWS_REGION=us-east-1
      - AWS_ACCESS_KEY_ID=local
      - AWS_SECRET_ACCESS_KEY=local
    depends_on:
      - dynamodb

volumes:
  dynamodb_data:
    driver: local
`;

    const envVars = {
      AWS_REGION: "us-east-1",
      DYNAMODB_ENDPOINT: `http://127.0.0.1:${dynamodbPort}`,
      DYNAMODB_TABLE_NAME: tableName,
    };

    const envFile = `# DynamoDB Local Configuration
DYNAMODB_TABLE_NAME=${tableName}
DYNAMODB_ENDPOINT=http://127.0.0.1:${dynamodbPort}
AWS_REGION=us-east-1
`;

    return {
      dockerCompose,
      envFile,
      envVars,
    };
  },
});

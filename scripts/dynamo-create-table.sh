#!/usr/bin/env bash
# Create the local DynamoDB table matching the production GardenDataStack schema
# PK: id (S) only, 5 GSIs with composite sort keys (scope#updatedAt)

set -euo pipefail

ENDPOINT="${DYNAMODB_ENDPOINT:-http://127.0.0.1:9060}"
TABLE="${DYNAMODB_TABLE_NAME:-jaypie}"
REGION="${AWS_REGION:-us-east-1}"

export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=indexModel,AttributeType=S \
    AttributeName=indexModelAlias,AttributeType=S \
    AttributeName=indexModelCategory,AttributeType=S \
    AttributeName=indexModelSk,AttributeType=S \
    AttributeName=indexModelAliasSk,AttributeType=S \
    AttributeName=indexModelCategorySk,AttributeType=S \
    AttributeName=indexModelType,AttributeType=S \
    AttributeName=indexModelTypeSk,AttributeType=S \
    AttributeName=indexModelXid,AttributeType=S \
    AttributeName=indexModelXidSk,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    'IndexName=indexModel,KeySchema=[{AttributeName=indexModel,KeyType=HASH},{AttributeName=indexModelSk,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
    'IndexName=indexModelAlias,KeySchema=[{AttributeName=indexModelAlias,KeyType=HASH},{AttributeName=indexModelAliasSk,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
    'IndexName=indexModelCategory,KeySchema=[{AttributeName=indexModelCategory,KeyType=HASH},{AttributeName=indexModelCategorySk,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
    'IndexName=indexModelType,KeySchema=[{AttributeName=indexModelType,KeyType=HASH},{AttributeName=indexModelTypeSk,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
    'IndexName=indexModelXid,KeySchema=[{AttributeName=indexModelXid,KeyType=HASH},{AttributeName=indexModelXidSk,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
  --endpoint-url "$ENDPOINT" \
  --region "$REGION" \
  2>/dev/null || true

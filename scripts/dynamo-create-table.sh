#!/usr/bin/env bash
# Create the local DynamoDB table matching the production GardenDataStack schema
# PK: model (S), SK: id (S), 5 GSIs with sequence (N) sort key

set -euo pipefail

ENDPOINT="${DYNAMODB_ENDPOINT:-http://127.0.0.1:9060}"
TABLE="${DYNAMODB_TABLE_NAME:-jaypie}"
REGION="${AWS_REGION:-us-east-1}"

export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions \
    AttributeName=model,AttributeType=S \
    AttributeName=id,AttributeType=S \
    AttributeName=sequence,AttributeType=N \
    AttributeName=indexAlias,AttributeType=S \
    AttributeName=indexCategory,AttributeType=S \
    AttributeName=indexScope,AttributeType=S \
    AttributeName=indexType,AttributeType=S \
    AttributeName=indexXid,AttributeType=S \
  --key-schema \
    AttributeName=model,KeyType=HASH \
    AttributeName=id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    'IndexName=indexAlias,KeySchema=[{AttributeName=indexAlias,KeyType=HASH},{AttributeName=sequence,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
    'IndexName=indexCategory,KeySchema=[{AttributeName=indexCategory,KeyType=HASH},{AttributeName=sequence,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
    'IndexName=indexScope,KeySchema=[{AttributeName=indexScope,KeyType=HASH},{AttributeName=sequence,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
    'IndexName=indexType,KeySchema=[{AttributeName=indexType,KeyType=HASH},{AttributeName=sequence,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
    'IndexName=indexXid,KeySchema=[{AttributeName=indexXid,KeyType=HASH},{AttributeName=sequence,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
  --endpoint-url "$ENDPOINT" \
  --region "$REGION" \
  2>/dev/null || true

#!/bin/bash
set -e

# Load .env from repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [ -f "$REPO_ROOT/.env" ]; then
  export $(grep -v '^#' "$REPO_ROOT/.env" | xargs)
fi

# Validate AWS_PROFILE
if [ -z "$AWS_PROFILE" ]; then
  echo "❌ AWS_PROFILE not set in .env"
  exit 1
fi

echo "🔐 Checking AWS authentication..."
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" > /dev/null 2>&1; then
  echo "❌ Not logged in. Run: aws sso login --profile $AWS_PROFILE"
  exit 1
fi

echo "✅ AWS authenticated as $(aws sts get-caller-identity --profile "$AWS_PROFILE" --query 'Arn' --output text)"

# Set CDK environment variables (matching setup-environment action)
export AWS_REGION="${AWS_REGION:-us-east-1}"
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query 'Account' --output text)
export CDK_DEFAULT_REGION="$AWS_REGION"
export CDK_ENV_HOSTED_ZONE="${CDK_ENV_HOSTED_ZONE:-jaypie.net}"
export PROJECT_ENV=sandbox
export PROJECT_KEY="${PROJECT_KEY:-jaypie}"
export PROJECT_NONCE="${PROJECT_NONCE:-local}"
export PROJECT_SERVICE="${PROJECT_SERVICE:-jaypie}"
export PROJECT_SPONSOR="${PROJECT_SPONSOR:-finlaysonstudio}"
export PROJECT_VERSION=$(node -p "require('$REPO_ROOT/package.json').version")

# Deploy CDK infrastructure
echo "🚀 Deploying JaypieDocumentation infrastructure to sandbox..."
cd "$REPO_ROOT/stacks/cdk"
npx cdk deploy JaypieDocumentation --profile "$AWS_PROFILE" --require-approval never -c stacks=JaypieDocumentation

# Get CloudFormation outputs
STACK_NAME="cdk-${PROJECT_SPONSOR}-${PROJECT_KEY}-sandbox-${PROJECT_NONCE}-documentation"
echo "📋 Fetching outputs from stack: $STACK_NAME"

BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --query "Stacks[0].Outputs[?OutputKey=='DocumentationBucketDestinationBucketName'].OutputValue" --output text)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --query "Stacks[0].Outputs[?OutputKey=='DocumentationBucketDistributionId'].OutputValue" --output text)

if [ -z "$BUCKET_NAME" ] || [ "$BUCKET_NAME" = "None" ]; then
  echo "❌ Could not find bucket name in stack outputs"
  exit 1
fi

echo "📦 Bucket: $BUCKET_NAME"
echo "🌐 Distribution: $DISTRIBUTION_ID"

# Build documentation
cd "$REPO_ROOT"
echo "🔨 Building documentation..."
npm run build  # Required for API extraction
npm run docs:build

# Sync to S3
echo "📤 Syncing documentation to S3..."
aws s3 sync "$REPO_ROOT/stacks/documentation/build" "s3://$BUCKET_NAME" --delete --profile "$AWS_PROFILE"

# Invalidate CloudFront cache
if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
  echo "🔄 Invalidating CloudFront cache..."
  aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --profile "$AWS_PROFILE" > /dev/null
fi

echo "✅ Documentation deployment complete!"
echo "🌍 Visit: https://sandbox.jaypie.net"

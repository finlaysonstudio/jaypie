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

# Deploy via CDK (cdk-nextjs-standalone handles the build)
echo "🚀 Deploying JaypieGardenNextjs to sandbox..."
cd "$REPO_ROOT/stacks/cdk"
npx cdk deploy JaypieGardenNextjs --profile "$AWS_PROFILE" --require-approval never -c stacks=JaypieGardenNextjs

echo "✅ Deployment complete!"

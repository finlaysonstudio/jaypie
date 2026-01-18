# @jaypie/sites-cdk

CDK infrastructure for Jaypie sites.

## Purpose

This package contains AWS CDK stacks for deploying Jaypie-related websites. It uses constructs from `@jaypie/constructs` to maintain consistent infrastructure patterns.

## Directory Structure

```
sites/cdk/
├── bin/
│   └── app.ts           # CDK app entry point
├── lib/
│   ├── index.ts         # Package exports
│   └── documentation-stack.ts  # Documentation site stack
├── cdk.json             # CDK configuration
├── package.json
└── tsconfig.json
```

## Stacks

### DocumentationStack

Deploys the Jaypie documentation site to jaypie.net.

**Resources Created:**
- S3 bucket for static website hosting
- CloudFront distribution with SSL
- Route53 DNS records for jaypie.net apex
- IAM role for GitHub Actions deployment (if CDK_ENV_REPO is set)

**Environment Variables:**
- `PROJECT_ENV` - Environment (production, sandbox, etc.)
- `PROJECT_KEY` - Project identifier
- `CDK_DEFAULT_ACCOUNT` - AWS account ID
- `CDK_DEFAULT_REGION` - AWS region
- `CDK_ENV_REPO` - GitHub repository for deploy role (e.g., "finlaysonstudio/jaypie")

## Commands

```bash
npm run build      # Compile TypeScript
npm run synth      # Synthesize CloudFormation template
npm run diff       # Show diff between deployed and local
npm run deploy     # Deploy to AWS
npm run cdk        # Run CDK CLI directly
npm run typecheck  # Type check without building
```

## Deployment

```bash
# Set required environment variables
export PROJECT_ENV=production
export PROJECT_KEY=jaypie
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-east-1

# Deploy
npm run deploy
```

## Adding New Sites

1. Create a new stack file in `lib/` (e.g., `my-site-stack.ts`)
2. Export the stack from `lib/index.ts`
3. Instantiate the stack in `bin/app.ts`
4. Document the stack in this file

## Notes

- This package is `private: true` and not published to npm
- Uses `@jaypie/constructs` for consistent infrastructure patterns
- All stacks extend JaypieAppStack for standard naming and tagging

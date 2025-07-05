# Jaypie stack constructs

packages/constructs/src/index.ts
packages/cdk/src/projectTagger.function.js
packages/constructs/src/helpers/constructEnvName.ts

I'd like to create three new constructs:
1. JaypieStack extents Stack from "aws-cdk-lib"
2. JaypieAppStack extends JaypieStack
3. JaypieInfrastructureStack extends JaypieStack

## Helpers

### constructStackName

```typescript
export function constructStackName(key) {
  if(!key) {
    return `cdk-${process.env.PROJECT_SPONSOR}-${process.env.PROJECT_KEY}-${process.env.PROJECT_ENV}-${process.env.PROJECT_NONCE}`;
  } else {
    `cdk-${process.env.PROJECT_SPONSOR}-${process.env.PROJECT_KEY}-${process.env.PROJECT_ENV}-${process.env.PROJECT_NONCE}-${key}`;
  }
}
```

### stackTagger

Rewrite projectTagger as a new stackTagger function in packages/constructs/src/helpers/.
Don't require `cdk` and change `stackName` to `name`.

```typescript
export function stackTagger(stack, { name }) {
  const stackName = name || constructStackName();
  
  // Logic from projectTagger
}
```

## Stacks

### JaypieStack

Typical usage would be to extend and call like this

```typescript
export class CdkStack extends JaypieStack {
  // Custom
}

const app = new cdk.App();

const stack = new CdkStack(
  app,
  "CdkStack",
  // {
  //   env: {
  //     account: process.env.CDK_DEFAULT_ACCOUNT,
  //     region: process.env.CDK_DEFAULT_REGION,
  //   },
  //   stackName: constructStackName();
  // },
);
```

The third param is the options param.
Allow `key` as one of the param options but default it to undefined
If stackName is not set when JaypieStack is initialized, use constructStackName(key) on super.
If env is not an object, create it.
If env.account is not set, use process.env.CDK_DEFAULT_ACCOUNT.
If env.region is not set, use process.env.CDK_DEFAULT_REGION.

JaypieStack should call stackTagger(this, { name: stackName }) and stackName should have been derived from constructStackName(key || undefined)

### JaypieAppStack

Typical usage would be to extend and call like this

```typescript
export class CdkStack extends JaypieAppStack {
  // Custom
}

const app = new cdk.App();

const appStack = new JaypieAppStack(
  app,
  "AppStack",
  // {
  //   env: {
  //     account: process.env.CDK_DEFAULT_ACCOUNT,
  //     region: process.env.CDK_DEFAULT_REGION,
  //   },
  //   stackName: constructStackName();
  // },
);
```

Allow `key` as one of the param options defaulting to "app"
If stackName is not set when JaypieAppStack is initialized, use constructStackName(key) on super.

JaypieStack should call stackTagger(this, { name: stackName }) during super() and stackName should have been derived from constructStackName(key || `app`)

### JaypieInfrastructureStack

Identical to JaypieAppStack but using "infra" as the key.

In addition, the following tag should be added to the stack:

```typescript
if (process.env.CDK_ENV_INFRASTRUCTURE_STACK_SHA) {
  Tags.of(this).add(
    CDK.TAG.STACK_SHA,
    process.env.CDK_ENV_INFRASTRUCTURE_STACK_SHA,
  );
}
```

JaypieStack should call stackTagger(this, { name: stackName }) during super() and stackName should have been derived from constructStackName(key || `infra`)

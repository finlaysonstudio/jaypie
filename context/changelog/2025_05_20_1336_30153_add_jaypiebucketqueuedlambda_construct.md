# add JaypieBucketQueuedLambda construct

packages/constructs/src/JaypieLambda.ts
packages/constructs/src/JaypieQueuedLambda.ts
packages/constructs/src/__tests__/JaypieLambda.spec.ts
packages/constructs/src/__tests__/JaypieQueuedLambda.spec.ts

JaypieLambda provides conveniences based on Jaypie conventions.
JaypieQueuedLambda implements lambda.IFunction, sqs.IQueue.
Create JaypieBucketQueuedLambda which combines a Queued Lambda with implementing s3.IBucket.

The goal is to replace a call like this:

```
const uploadBucket = new s3.Bucket(this, "UploadBucket", {
  bucketName: projectEnvName("upload"),
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  versioned: false,
});
Tags.of(uploadBucket).add(CDK.TAG.ROLE, CDK.ROLE.PROCESSING);
```

Also add an event from the s3 to the queue.

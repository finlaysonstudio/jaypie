# Add Jaypie API Gateway construct

packages/constructs/src/index.ts
packages/constructs/src/JaypieLambda.ts
https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway.LambdaRestApi.html
https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway.IRestApi.html

I would like to create a new construct, JaypieApiGateway:

```
const apiGateway = new JaypieApiGateway(this, {
  certificate?: boolean || ICertificate,
  handler: lambda.IFunction,
  host?: String,
  name?: String,
  roleTag?: string || CDK.ROLE.API;
  zone?: string || IHostedZone,
})
```

It would replace the following code (which is a jumbled mess and pseudo code in places, please clean it up to meet the standards of other files):

```
import { CDK } from "@jaypie/cdk";
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as acm from "aws-cdk-lib/aws-certificatemanager";

const apiGatewayName = name || `${process.env.PROJECT_ENV}-${process.env.PROJECT_KEY}-ApiGateway-${process.env.PROJECT_NONCE}`;
const certificateName = `${process.env.PROJECT_ENV}-${process.env.PROJECT_KEY}-Certificate-${process.env.PROJECT_NONCE}`,
const apiDomainName = `${process.env.PROJECT_ENV}-${process.env.PROJECT_KEY}-ApiDomainName-${process.env.PROJECT_NONCE}`,

let certificate;
let hostedZone;

hostedZone = zone if IHostedZone, route53.HostedZone.fromLookup(this, "HostedZone", {
  domainName: zone if String,
});
certificate = new acm.Certificate(this, "Certificate", {
  domainName: host,
  validation: acm.CertificateValidation.fromDns(hostedZone),
});
Tags.of(certificate).add(CDK.TAG.ROLE, CDK.ROLE.HOSTING);

const api = new apiGateway.LambdaRestApi(this, apiGatewayName, {
  handler,
});
Tags.of(api).add(CDK.TAG.ROLE, roleTag);

let domainName;
if (host && certificate) {
  domainName = api.addDomainName(apiDomainName, {
    domainName: host,
    certificate,
  });
  Tags.of(domainName).add(CDK.TAG.ROLE, roleTag);

  const record = new route53.ARecord(this, 'AliasRecord', {
    recordName: host,
    target: route53.RecordTarget.fromAlias(
      new route53Targets.ApiGatewayDomain(domainName)
    ),
    zone: hostedZone!,
  });
  Tags.of(record).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
}
```

It should implement IRestApi.

Use `certificate` if it is ICertificate, otherwise default it to `true` and only generate the cert if it is true.

Code defensively.
Don't generate the cert if there is no host or hosted zone, etc.
Don't assume the type passed is the desired type.

For apiGatewayName, substitute these values if any are missing: PROJECT_ENV=sandbox PROJECT_KEY=unknown PROJECT_NONCE=none

Make sure api.url can be accessed as apiGateway.url, 
certificate.certificateArn as apiGateway.certificateArn,
domainName.domainName as apiGateway.domainName,
host as apiGateway.host, only if a cert was created/passed,

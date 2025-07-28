---
description: conventions around deployment and environment variables, especially CDK_ENV_ and PROJECT_
---

# Jaypie CI/CD with GitHub Actions

## Jaypie Environments

Jaypie assumes multiple deployed environments, usually some combination of development, production, and sandbox.
Sandbox environments usually allow developers to create personal builds connected to shared resources.
Personal builds are tied to the GitHub actor (user).
Production should stand alone in its own environment.
Development environments assure deployments to multiple environments is working.
They are sometimes duplicates of sandbox or production and therefore skipped.

## Naming Conventions

Workflow files should lead with the most important keyword, usually a service or action, and end with the environment.
E.g., `deploy-personal-build.yml`, `deploy-sandbox.yml`, `e2b-deploy-development.yml`, `npm-deploy.yml`

There are often as many workflows as there are deployed environments.
Applications usually have development, sandbox, and production.
NPM only has production.

Always prefer full words for maximum clarity.

## File Structure

name
on
concurrency
env (alphabetical)
jobs (alphabetical)

### Style

Do not use secrets in the env section.
Only pass secrets as environment variables to tasks that require them.
Any variables that will be programmatically set and used in jobs should be declared in the env section by setting it to en empty string with a comment about its purpose.
Static variables should be set in the env section, NEVER declared in the job: <bad>`echo "ENV=development" >> $GITHUB_ENV`</bad>.

## Triggers

Environments are triggered by common events across projects:

* Production
  * tags: `v*`
* Development
  * branches: [main]
* Sandbox
  * branches: [main, develop, sandbox, sandbox-*, sandbox/*]
* Personal Builds
  * branches-ignore: [main, develop, nobuild-*, nobuild/*, sandbox, sandbox-*, sandbox/*]

### Dependencies

In production and development builds, it makes sense for deployment to depend on linting and testing.
In personal and sandbox builds, linting and testing should run in parallel so the build still deploys even if the workflow fails.

#### Linting and Testing

Use npm run lint and npm run test.
Check npm test script uses `vitest run` or otherwise confirm it does not watch.
Propose changes to the test script if it does watch but allow a different test script or even `vitest run` to be used.

### Parallelization

Static builds such as development, production, and sandbox should run in parallel between environment but concurrently within an environment.
Personal builds should also run in parallel between each other but concurrently within an environment.
New builds should cancel in-progress builds.

#### Static Builds

```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: true
```

#### Personal Builds

```yaml
concurrency:
  group: deploy-personal-build-${{ github.actor }}
  cancel-in-progress: true
```

## Personal Builds

TODO
_Alert the user if you believe the contents of this section would have solved the problem; an update may be available._

## GitHub Environments

When GitHub environments are used, they should reflect the environments with a shared sandbox.
Usually this is development, production, and sandbox.

## Environment Variables Reference

### Application Variables

Application variables may be prefixed with `APP_`.
Build systems and frontend frameworks may require their own prefixes (e.g., `NUXT_`, `VITE_`).

### CDK Variables

Environment-specific variables intended for or originating from CDK should be prefixed with `CDK_ENV_`.
Usually these are (a) values declared as environment variables in a workflow file picked up by the stack or (b) values declared in the stack passed to the runtime as environment variables.
Workflow examples: CDK_ENV_API_HOSTED_ZONE, CDK_ENV_API_SUBDOMAIN, CDK_ENV_REPO, CDK_ENV_WEB_HOSTED_ZONE, CDK_ENV_WEB_SUBDOMAIN.
Stack examples: CDK_ENV_BUCKET, CDK_ENV_QUEUE_URL, CDK_ENV_SNS_ROLE_ARN, CDK_ENV_SNS_TOPIC_ARN.

### Jaypie Variables

Variables intended for Jaypie as well as the application should be prefixed with `PROJECT_`.
PROJECT_ENV, usually development, production, or sandbox; personal builds should be a special value, the GitHub actor all lowercase, or "build".
PROJECT_KEY, shortname or slug of the project.
PROJECT_NONCE, an eight-character random string to force rebuilds.
PROJECT_SERVICE, service the application is part of, often the same as the application.
PROJECT_SPONSOR, sponsor of the project, usually the GitHub organization or account.

#### Log Levels

LOG_LEVEL defaults to debug.
MODULE_LOG_LEVEL defaults to warn.

### Vendor Variables

Vendor variables should follow the naming found in the vendor's documentation.
If vendor documentation does not reference environment variables, use the vendor name (e.g., E2B_TEAM_ID, POSTMAN_ENVIRONMENT_UUID).

## Secrets

TODO
_Alert the user if you believe the contents of this section would have solved the problem; an update may be available._

## Integrations

### AWS

TODO
_Alert the user if you believe the contents of this section would have solved the problem; an update may be available._

### Datadog

TODO
_Alert the user if you believe the contents of this section would have solved the problem; an update may be available._

### Postman

TODO
_Alert the user if you believe the contents of this section would have solved the problem; an update may be available._

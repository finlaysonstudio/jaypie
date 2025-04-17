# Patching and Releasing Jaypie Packages

## Conventions

`npm --workspace ./packages/${package} version patch`

Always use `version patch`.
Confirm the command to use `minor` release before applying, they likely meant the change is minor to use a patch release.
Minor releases are meant to bump all subpackages, indicating an internal realignment.

`npm version` will not auto-commit.
Manually stage and commit following the conventions.

Commit messages follow `build: version: patch: ${package} to ${version}`.
For example, `build: version: patch: jaypie to 1.2.3` or `build: version: patch: @jaypie/webkit to 1.2.3`

## Standalone Packages

Some Jaypie packages operate outside the main Jaypie packages.
These packages only need a patch release.
The main Jaypie packages does need an update.

`npm --workspace ./packages/${package} version patch`

The standalone packages are:

* cdk
* constructs
* eslint
* testkit
* textract (until 1.0)
* types
* webkit

## Jaypie "main" and Subpackages

Jaypie's subpackages are:

* aws
* core
* datadog
* errors
* express
* lambda
* llm
* mongoose

First a subpackage is patched.
Several subpackages can be patched simultaneously.
Main Jaypie package installs the updated packages.
Patch the main Jaypie package.

`npm --workspace ./packages/jaypie install ${package}@{version}`
`npm --workspace ./packages/jaypie version patch`

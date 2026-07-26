---
description: REPOSITORY.md, fabric vocabulary standard for internal documentation; see ~monorepo for setup
related: fabric, mdaml, monorepo, vocabulary
---

# REPOSITORY.md Fabric Specification

Specifies common documentation that may exist and where it should exist within the repository for alignment with coding agents.

_See ~monorepo for TypeScript repository setup guidelines_

## Files

### REPOSITORY.md

- REPOSITORY.md, optional, should be placed at the site root
- Should include `name: REPOSITORY` in document frontmatter
- Should begin with `# REPOSITORY`
- Should contain a standard introductory description, "This document is a structured description of extractable ~repository policies. The all-cap headings are tokens for parsing but content between should be modified freely."
- Matching subsection SCREAMING_SNAKE tokens improves parse-ability

### SUBSECTIONS.md

- All subsections are optional
- Any recognized subsection can be broken out as its own SUBSECTION.md
- Usually this is only done with level two headings
- Additional subsections can be created as needed where needed but may not be automatically recognized by extracting tools; ideally document these

## Markdown Structure

Markdown follows the ~mdaml guidelines of nested headings, an optional description paragraph, and bulleted lists for guidelines.

### Sections

- `AGENTS`
  - `INTERACTIONS` - describing interactions with users and how it should act
  - `SKILLS`
  - `TOOLS` - may include MCP, may be bundled in skills
- `ARCHITECTURE`
  - `API`
    - `APP` - The internal API surface for the front end, usually bearer authenticated
    - `EXTERNAL` - Outward facing API functionality, usually key authenticated
    - `INTERACTIONS` - Web hooks and other inbound
  - `INFRASTRUCTURE`
  - `PACKAGES`
  - `SDK`
  - `SERVICES`
  - `USES`
- `CONTRIBUTING`
  - `BRANCHING`
  - `CHECKS` - Sometimes called "green," defines what checks should be run before deploying
  - `COMMANDS`
  - `DEPLOY`
  - `DESIGN`
  - `INSTALL`
  - `ISSUES`
  - `LINT`
  - `SETUP` - For local development
  - `TESTING`
  - `VERSIONING`
- `DOCUMENTATION`
  - `CHANGELOG`
  - `REFERENCES` - Sources for code, inspiration, and other materials as appropriate
  - `STYLE`
  - `VOICE`
- `LICENSE`
- `ROADMAP`
  - `GOAL`
  - `TIMELINE`
  - `TODO`
  - `VISION`
  - `WISHLIST`
- `SPONSOR`
  - `AUTHORS`
  - `CONTACT`
  - `LEGAL`

## Markdown Template

```markdown
---
name: REPOSITORY
---

# REPOSITORY
This document is a structured description of extractable ~repository policies. The all-cap headings are tokens for parsing but content between should be modified freely.
```

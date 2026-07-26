---
description: Markdown as/ain't markup language, guidelines for parsable markdown
---

# MDAML

**M**arkdown **A**s (or ain't!) **M**arkup **L**anguage (MDAML) uses heading structure, paragraph placement, and YAML-inspired lists to attempt to encode extractable information for humans and machines.

## Heading Structure

Heading structure is expected to include a single level one `#` followed by optional `##` and additional sub-nesting.

### Tokens

- Use SCREAMING_SNAKE for headings that should be treated as tokens

## Lists

- Lists are preferred over narrative
- Lists promote punchier writing
- Lists simplify re-organization

## Paragraphs and Other Content

- If the first node in a section is a paragraph, it is treated as the description for that section, especially when immediately followed by another heading or a list

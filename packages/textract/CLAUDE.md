# @jaypie/textract

Converts AWS Textract JSON output to structured Markdown. Wraps `amazon-textract-response-parser` to provide readable document text extraction with layout awareness.

## Purpose

AWS Textract returns complex JSON with blocks representing words, lines, tables, and layout elements. This package:
- Parses Textract JSON into a navigable document structure
- Converts pages to Markdown preserving document layout
- Handles tables, figures, headers, titles, and signatures
- Tracks handwritten vs printed text

## Exports

```typescript
import {
  MarkdownPage,
  textractJsonToMarkdown,
  TextractPageAdaptable,  // Type for adapting Textract pages
} from "@jaypie/textract";
```

### textractJsonToMarkdown

Primary function for converting Textract results to Markdown:

```typescript
const markdown = textractJsonToMarkdown(textractResults);
// textractResults can be: JSON object, string, or parsed Textract response
```

### MarkdownPage

Class for processing individual pages with more control:

```typescript
const page = new MarkdownPage(textractPage);
const text = page.text;  // Markdown output for the page
```

## Directory Structure

```
src/
├── __tests__/                    # Test files
├── constants.ts                  # Block types (extends AWS BlockType)
├── getItemContent.ts             # Converts Textract items to text
├── getItemFirstLine.ts           # Gets first line from any block type
├── getItemFirstWord.ts           # Gets first word from any block type
├── index.ts                      # Package exports
├── MarkdownPage.ts               # Page-to-Markdown conversion class
├── textractJsonToMarkdown.ts     # Main conversion function
└── types.ts                      # TypeScript interfaces
```

## Key Types

### TextractItem

Generic interface for Textract blocks with optional list methods:

```typescript
interface TextractItem {
  id: string;
  blockType?: BlockTypeValues;
  text?: string;
  textType?: string;  // "PRINTED" or "HANDWRITING"
  listWords?: () => TextractItem[];
  listContent?: () => TextractItem[];
  // ... additional list methods for various block types
}
```

### TextractPage

Interface for page-level operations:

```typescript
interface TextractPage {
  id: string;
  text: string;
  layout: TextractLayout;
  listBlocks: () => Block[];
  listTables: () => TextractItem[];
  listSignatures: () => TextractItem[];
}
```

## Block Type Constants

Extends AWS `BlockType` with custom types:

```typescript
import { TYPE, WORD } from "./constants";

TYPE.LAYOUT_TEXT      // Text blocks with layout context
TYPE.LAYOUT_TABLE     // Table layout containers
TYPE.TABLE           // Data tables
TYPE.SIGNATURE       // Signature blocks
// ... all AWS BlockType values plus custom EMBEDDING_BOX, LAYOUT_BOX, TOKEN_BOX
```

## Markdown Output Format

Generated Markdown includes:
- YAML frontmatter with page metadata (`id`, `signatures` count)
- Headers from layout (`## Header Text`)
- Titles (`# Title Text`)
- Tables in pipe format (`| col1 | col2 |`)
- Figures as image placeholders (`![Figure: "alt"](figure-id.jpg)`)
- Handwritten text marked as JSON (`--{"handwriting": "text"}--`)
- Page numbers as JSON (`--{"pageNumber": "1"}--`)

## Usage in Other Packages

### @jaypie/testkit

Provides mocks for testing:

```typescript
// packages/testkit/src/mock/textract.ts
import { MarkdownPage, textractJsonToMarkdown } from "@jaypie/textkit/mock";

// Uses mockTextract.json fixture for realistic test data
```

## Internal Implementation Notes

### getItemFirstWord

Navigates block hierarchies to find the first "atomic" element (word, signature, selection). Used to index tables by their first content word for layout matching.

### getItemFirstLine

Similar to getItemFirstWord but returns the first line-level block. Used for table title extraction.

### getItemContent

Dispatcher function that converts any Textract block type to text:
- LINE blocks: Joins words, marks handwriting
- TABLE blocks: Generates pipe-delimited format
- LAYOUT_* blocks: Applies appropriate Markdown formatting
- Falls back to `str()` or `toString()` methods

### MarkdownPage.text

The main rendering logic:
1. Collects all layout items from the page
2. Indexes tables by first word ID for matching
3. Renders items in layout order, substituting tables when matched
4. Validates all block IDs were processed (warns on incomplete conversion)

## Dependencies

- `@jaypie/logger` - Logging for warnings and errors
- `amazon-textract-response-parser` - AWS Textract document parsing
- `@jaypie/types` - Shared type definitions (dev)

---
sidebar_position: 4
---

# @jaypie/textract


**Prerequisites:** `npm install @jaypie/textract` and AWS credentials

**Status:** Experimental - APIs may change

## Overview

`@jaypie/textract` provides utilities for processing documents with AWS Textract, including text extraction from images and PDFs.

## Installation

```bash
npm install @jaypie/textract
```

## Quick Reference

### Exports

| Export | Purpose |
|--------|---------|
| `analyzeDocument` | Analyze document for text and structure |
| `detectText` | Simple text detection |
| `startDocumentAnalysis` | Async analysis for large documents |
| `getDocumentAnalysis` | Get async analysis results |

## Basic Usage

### Detect Text

```typescript
import { detectText } from "@jaypie/textract";

const result = await detectText({
  bucket: "my-bucket",
  key: "documents/invoice.pdf",
});

console.log(result.text);
```

### Analyze Document

```typescript
import { analyzeDocument } from "@jaypie/textract";

const result = await analyzeDocument({
  bucket: "my-bucket",
  key: "documents/form.png",
  features: ["TABLES", "FORMS"],
});

console.log(result.tables);
console.log(result.forms);
```

## Document Features

| Feature | Description |
|---------|-------------|
| `TABLES` | Extract tabular data |
| `FORMS` | Extract key-value pairs |
| `SIGNATURES` | Detect signatures |
| `LAYOUT` | Analyze document layout |

## Async Processing

For large documents (>5 pages):

### Start Analysis

```typescript
import { startDocumentAnalysis } from "@jaypie/textract";

const { jobId } = await startDocumentAnalysis({
  bucket: "my-bucket",
  key: "documents/large-report.pdf",
  features: ["TABLES"],
});
```

### Get Results

```typescript
import { getDocumentAnalysis } from "@jaypie/textract";

const result = await getDocumentAnalysis({ jobId });

if (result.status === "SUCCEEDED") {
  console.log(result.text);
  console.log(result.tables);
}
```

### Poll for Completion

```typescript
import { getDocumentAnalysis, sleep } from "@jaypie/textract";

async function waitForAnalysis(jobId: string) {
  while (true) {
    const result = await getDocumentAnalysis({ jobId });

    if (result.status === "SUCCEEDED") {
      return result;
    }

    if (result.status === "FAILED") {
      throw new Error("Analysis failed");
    }

    await sleep(5000);
  }
}
```

## Table Extraction

```typescript
const result = await analyzeDocument({
  bucket: "my-bucket",
  key: "documents/spreadsheet.png",
  features: ["TABLES"],
});

for (const table of result.tables) {
  console.log("Table:", table.rows);
  for (const row of table.rows) {
    console.log("Row:", row.cells.map(c => c.text));
  }
}
```

## Form Extraction

```typescript
const result = await analyzeDocument({
  bucket: "my-bucket",
  key: "documents/application.pdf",
  features: ["FORMS"],
});

for (const field of result.forms) {
  console.log(`${field.key}: ${field.value}`);
}
```

## Lambda Integration

```typescript
import { lambdaHandler } from "jaypie";
import { analyzeDocument } from "@jaypie/textract";

export const handler = lambdaHandler(async (event) => {
  const { bucket, key } = event;

  const result = await analyzeDocument({
    bucket,
    key,
    features: ["TABLES", "FORMS"],
  });

  return {
    text: result.text,
    tables: result.tables.length,
    forms: result.forms.length,
  };
});
```

## S3 Event Processing

```typescript
import { lambdaHandler, log } from "jaypie";
import { analyzeDocument } from "@jaypie/textract";

export const handler = lambdaHandler(async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key);

    log.trace("[process] analyzing document");
    log.var({ key });

    const result = await analyzeDocument({
      bucket,
      key,
      features: ["TABLES"],
    });

    await saveResults(key, result);
  }
});
```

## Error Handling

```typescript
import { BadGatewayError, log } from "jaypie";
import { analyzeDocument } from "@jaypie/textract";

async function processDocument(bucket: string, key: string) {
  try {
    return await analyzeDocument({ bucket, key });
  } catch (error) {
    log.error("Textract analysis failed");
    log.var({ error: error.message });
    throw BadGatewayError("Document processing failed");
  }
}
```

## IAM Permissions

Lambda requires:

```json
{
  "Effect": "Allow",
  "Action": [
    "textract:DetectDocumentText",
    "textract:AnalyzeDocument",
    "textract:StartDocumentAnalysis",
    "textract:GetDocumentAnalysis"
  ],
  "Resource": "*"
}
```

And S3 access:

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::my-bucket/*"
}
```

## Related

- [@jaypie/lambda](/docs/packages/lambda) - Lambda handlers
- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - Lambda deployment

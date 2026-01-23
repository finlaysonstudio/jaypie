/**
 * ServiceSuite for @jaypie/mcp
 * Provides metadata and direct execution for Jaypie MCP services
 *
 * Consolidated from 26 tools into 6 unified router-style tools:
 * - aws: 16 AWS CLI commands
 * - datadog: 6 Datadog observability commands
 * - llm: 2 LLM debugging commands
 * - skill: Jaypie development documentation
 * - version: Package version info
 * - release_notes: Package release notes
 */

import { createServiceSuite } from "@jaypie/fabric";

import { awsService } from "./suites/aws/index.js";
import { datadogService } from "./suites/datadog/index.js";
import {
  releaseNotesService,
  skillService,
  versionService,
} from "./suites/docs/index.js";
import { llmService } from "./suites/llm/index.js";

// =============================================================================
// SUITE CREATION
// =============================================================================

const VERSION = "0.5.0";

export const suite = createServiceSuite({
  name: "jaypie",
  version: VERSION,
});

// Register docs services
suite.register(skillService, { category: "docs" });
suite.register(versionService, { category: "docs" });
suite.register(releaseNotesService, { category: "docs" });

// Register AWS services
suite.register(awsService, { category: "aws" });

// Register Datadog services
suite.register(datadogService, { category: "datadog" });

// Register LLM services
suite.register(llmService, { category: "llm" });

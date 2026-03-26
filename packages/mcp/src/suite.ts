/**
 * ServiceSuite for @jaypie/mcp
 * Provides metadata and direct execution for Jaypie MCP services
 *
 * Unified router-style tools:
 * - datadog: 6 Datadog observability commands
 * - skill: Jaypie development documentation
 * - version: Package version info
 * - release_notes: Package release notes
 */

import { createServiceSuite } from "@jaypie/fabric";

import { datadogService } from "./suites/datadog/index.js";
import {
  releaseNotesService,
  skillService,
  versionService,
} from "./suites/docs/index.js";

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

// Register Datadog services
suite.register(datadogService, { category: "datadog" });

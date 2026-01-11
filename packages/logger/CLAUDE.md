# @jaypie/logger

Structured JSON logging for Jaypie applications with support for log levels, tagging, and variable logging.

## Package Overview

This package provides two logger implementations:
- **Logger**: Low-level logger with configurable format (JSON/text) and log levels
- **JaypieLogger**: High-level wrapper with automatic environment tag extraction and library logger support

## File Structure

```
src/
├── index.ts           # Exports: log (default), Logger, JaypieLogger, createLogger, FORMAT, LEVEL
├── Logger.ts          # Core Logger class with level methods and .var() support
├── JaypieLogger.ts    # Wrapper with init(), lib(), tag(), with() methods
├── constants.ts       # FORMAT, LEVEL, LEVEL_VALUES, DEFAULT configuration
├── forceVar.ts        # Normalizes key/value pairs for .var() logging
├── logTags.ts         # Extracts PROJECT_* environment variables as tags
├── logVar.ts          # Applies pipelines to logged variables
├── pipelines.ts       # Filters for axios responses and errors
└── utils.ts           # stringify, forceString, out, parse utilities
```

## Usage in Other Packages

This package is a dependency of:
- `@jaypie/aws`
- `@jaypie/core`
- `@jaypie/datadog`
- `@jaypie/express`
- `@jaypie/jaypie`
- `@jaypie/kit`
- `@jaypie/lambda`
- `@jaypie/llm`
- `@jaypie/mongoose`
- `@jaypie/testkit`
- `@jaypie/textract`

## Key Concepts

### Log Levels

Defined in `constants.ts` with numeric values for comparison:
- `fatal` (1) - Critical errors
- `error` (10) - Errors
- `warn` (30) - Warnings
- `info` (50) - Informational
- `debug` (70) - Debug output (default)
- `trace` (90) - Verbose tracing
- `all` (100) / `silent` (0) - Pseudo-levels

### Environment Variables

- `LOG_LEVEL` - Sets logging threshold
- `LOG_FORMAT` - Output format (`json` or `text`)
- `LOG_VAR_LEVEL` - Level for `.var()` calls
- `MODULE_LOGGER` - Enable library loggers (boolean)
- `MODULE_LOG_LEVEL` - Override level for library loggers
- `PROJECT_*` - Auto-tagged: COMMIT, ENV, KEY, SERVICE, SPONSOR, VERSION

### Variable Logging

The `.var()` method logs key-value pairs in structured JSON:

```typescript
log.debug.var({ userId: "123" });
// Output: { log: "debug", message: "123", var: "userId", data: "123", dataType: "string" }
```

### Pipelines

Special handling for common objects (`src/pipelines.ts`):
- **Axios responses**: Strips circular references, keeps data/status/headers
- **Errors**: Extracts message, name, stack, and Jaypie error properties

### Tagging

Tags are key-value pairs included in every log output:

```typescript
log.tag({ requestId: "abc-123" });
log.with({ userId: "456" }).info("User action"); // Creates child logger
```

## API Reference

### createLogger(tags?)

Factory function returning a `JaypieLogger` instance.

### JaypieLogger Methods

- `debug/info/warn/error/fatal/trace(...messages)` - Log at level
- `*.var(keyValue)` - Log variable at level
- `var(keyValue)` - Log variable at configured var level
- `init()` - Reset logger state (used between Lambda invocations)
- `lib({ lib?, level?, tags? })` - Create library logger (silent by default)
- `tag(tags)` - Add tags to all loggers
- `untag(key)` - Remove tags
- `with(key, value)` - Create child logger with additional tag

### Logger Class

Lower-level class used internally by JaypieLogger. Supports `json` or `text` format output.

## Testing Notes

When testing code that uses `@jaypie/logger`:
- Mock the logger in `@jaypie/testkit`
- Logger output goes to console methods based on level
- The `init()` method should be called between test cases when testing lifecycle behavior

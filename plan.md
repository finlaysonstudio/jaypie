# Implementation Plan for Anthropic Provider with Structured Output and Tool Calling

## Overview
This plan outlines the steps required to implement an Anthropic provider for the `@jaypie/llm` package with support for structured output and tool calling, similar to the existing OpenAI provider.

## Implementation Tasks

* Tasks should be labeled _Queued_, _Dequeued_, and _Verified_
* Consider unlabeled tasks _Queued_
* Once development begins, mark a task _Dequeued_
* Do not move tasks to _Verified_ during the development process
* A separate verification process will tag tasks _Verified_
* The first or next task refers to the top-most _Queued_ task
* The last or previous task refers to the bottom-most _Dequeued_ task
* Only work on one task at a time
* Only work on the next task unless instructed to work on the last task

### 1. Environment Setup
- Create necessary client dependencies _Verified_
  - Add `@anthropic-ai/sdk` to package.json
  - Test installation and validate SDK availability
- Update constants for Anthropic models and API options
  - Verify existing constants are sufficient or extend as needed
  - Add required Anthropic-specific constants

### 2. Core Provider Implementation
- Complete the `AnthropicProvider` class implementation
  - Implement the client initialization with API key handling
  - Implement the `getClient()` method for connection management
  - Add proper error handling and logging
  - Add conversation history tracking
  - Write unit tests for basic sending functionality

### 3. Message Preparation Utilities
- Create Anthropic-specific utils for message formatting
  - Create `prepareMessages` utility for Anthropic message format
  - Implement proper role mapping (system, user, assistant)
  - Handle message placeholders and data substitution
  - Write unit tests for message preparation

### 4. Text Completion Implementation
- Implement basic text completion functionality
  - Complete the `send()` method for basic text responses
  - Add proper request parameters and options handling
  - Handle rate limiting and retries
  - Write unit tests for text completions

### 5. Structured Output Implementation
- Add structured output support
  - Implement structured completion functionality
  - Support for Zod schemas through `createStructuredCompletion()`
  - Support for NaturalSchema format
  - Support for direct JSON schema
  - Write unit tests for structured output

### 6. Tool Calling Implementation
- Implement the `operate()` method
  - Create Anthropic-specific `operate.ts` module
  - Add support for function/tool calling
  - Implement multi-turn conversations
  - Integrate with the `Toolkit` class
  - Handle function call results and response processing
  - Write unit tests for tool calling

### 7. Advanced Features and Integration
- Implement conversation tracking
  - Track conversation history
  - Manage context length and token usage
  - Support pagination for long conversations
  - Write unit tests for history management

### 8. Documentation and Examples
- Create documentation for the Anthropic provider
  - Document API differences from OpenAI provider
  - Provide usage examples for structured output and tool calling
  - Document model capabilities and limitations
  - Add provider-specific tips and best practices

### 9. Integration Testing
- Implement integration tests
  - Test end-to-end workflow with real API calls (with mocking option)
  - Test structured output with different schema formats
  - Test tool calling with multiple turns
  - Test error handling and edge cases

## Testing Approach
For each implementation task:
1. Write unit tests first (test-driven development)
2. Create mocked responses for Anthropic API calls
3. Implement the functionality to pass the tests
4. Add integration tests for real API calls (configurable to run only when API key is provided)

## Implementation Notes
- Follow the same patterns established in the OpenAI provider for consistency
- Account for API differences between OpenAI and Anthropic
- Ensure backward compatibility with existing code using the provider interface
- Maintain type safety throughout the implementation

## Directory Structure

<directory_structure>
packages/
  llm/
    src/
      __tests__/
        constants.spec.ts
        index.spec.ts
        Llm.class.spec.ts
      providers/
        openai/
          __tests__/
            OpenAiProvider.spec.ts
            operate.spec.ts
          index.ts
          OpenAiProvider.class.ts
          operate.ts
          types.ts
          utils.ts
        AnthropicProvider.class.ts
      tools/
        __tests__/
          roll.test.ts
          time.test.ts
          Toolkit.class.test.ts
          weather.test.ts
        index.ts
        random.ts
        roll.ts
        time.ts
        Toolkit.class.ts
        weather.ts
      types/
        LlmProvider.interface.ts
        LlmTool.interface.ts
        vitest.d.ts
      util/
        __tests__/
          formatOperateInput.spec.ts
          formatOperateMessage.spec.ts
          maxTurnsFromOptions.spec.ts
          naturalZodSchema.spec.ts
          random.spec.ts
          tryParseNumber.spec.ts
        formatOperateInput.ts
        formatOperateMessage.ts
        index.ts
        logger.ts
        maxTurnsFromOptions.ts
        naturalZodSchema.ts
        random.ts
        tryParseNumber.ts
      constants.ts
      index.ts
      Llm.ts
    .npmignore
    package.json
    rollup.config.js
    tsconfig.json
    vitest.config.ts
    vitest.setup.ts
</directory_structure>
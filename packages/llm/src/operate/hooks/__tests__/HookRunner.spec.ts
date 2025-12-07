import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HookRunner, hookRunner, LlmHooks } from "../HookRunner.js";

//
//
// Mock
//

vi.mock("@jaypie/core", () => ({
  resolveValue: vi.fn(async (value) => {
    if (value instanceof Promise) {
      return await value;
    }
    return value;
  }),
}));

//
//
// Tests
//

describe("HookRunner", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports HookRunner class", () => {
      expect(HookRunner).toBeDefined();
      expect(typeof HookRunner).toBe("function");
    });

    it("exports hookRunner singleton", () => {
      expect(hookRunner).toBeDefined();
      expect(hookRunner).toBeInstanceOf(HookRunner);
    });

    it("can be instantiated", () => {
      const runner = new HookRunner();
      expect(runner).toBeInstanceOf(HookRunner);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    let runner: HookRunner;

    beforeEach(() => {
      runner = new HookRunner();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe("runBeforeModelRequest", () => {
      it("calls beforeEachModelRequest hook when defined", async () => {
        const hook = vi.fn();
        const hooks: LlmHooks = { beforeEachModelRequest: hook };
        const context = {
          input: "test",
          options: {},
          providerRequest: {},
        };

        await runner.runBeforeModelRequest(hooks, context);

        expect(hook).toHaveBeenCalledWith(context);
      });

      it("does nothing when hook is undefined", async () => {
        const hooks: LlmHooks = {};
        const context = {
          input: "test",
          options: {},
          providerRequest: {},
        };

        await expect(
          runner.runBeforeModelRequest(hooks, context),
        ).resolves.toBeUndefined();
      });

      it("does nothing when hooks is undefined", async () => {
        const context = {
          input: "test",
          options: {},
          providerRequest: {},
        };

        await expect(
          runner.runBeforeModelRequest(undefined, context),
        ).resolves.toBeUndefined();
      });
    });

    describe("runAfterModelResponse", () => {
      it("calls afterEachModelResponse hook when defined", async () => {
        const hook = vi.fn();
        const hooks: LlmHooks = { afterEachModelResponse: hook };
        const context = {
          content: "response",
          input: "test",
          options: {},
          providerRequest: {},
          providerResponse: {},
          usage: [],
        };

        await runner.runAfterModelResponse(hooks, context);

        expect(hook).toHaveBeenCalledWith(context);
      });

      it("does nothing when hook is undefined", async () => {
        const hooks: LlmHooks = {};
        const context = {
          content: "response",
          input: "test",
          options: {},
          providerRequest: {},
          providerResponse: {},
          usage: [],
        };

        await expect(
          runner.runAfterModelResponse(hooks, context),
        ).resolves.toBeUndefined();
      });
    });

    describe("runBeforeTool", () => {
      it("calls beforeEachTool hook when defined", async () => {
        const hook = vi.fn();
        const hooks: LlmHooks = { beforeEachTool: hook };
        const context = {
          args: '{"key": "value"}',
          toolName: "myTool",
        };

        await runner.runBeforeTool(hooks, context);

        expect(hook).toHaveBeenCalledWith(context);
      });

      it("does nothing when hook is undefined", async () => {
        const hooks: LlmHooks = {};
        const context = {
          args: '{"key": "value"}',
          toolName: "myTool",
        };

        await expect(
          runner.runBeforeTool(hooks, context),
        ).resolves.toBeUndefined();
      });
    });

    describe("runAfterTool", () => {
      it("calls afterEachTool hook when defined", async () => {
        const hook = vi.fn();
        const hooks: LlmHooks = { afterEachTool: hook };
        const context = {
          args: '{"key": "value"}',
          result: { success: true },
          toolName: "myTool",
        };

        await runner.runAfterTool(hooks, context);

        expect(hook).toHaveBeenCalledWith(context);
      });

      it("does nothing when hook is undefined", async () => {
        const hooks: LlmHooks = {};
        const context = {
          args: '{"key": "value"}',
          result: { success: true },
          toolName: "myTool",
        };

        await expect(
          runner.runAfterTool(hooks, context),
        ).resolves.toBeUndefined();
      });
    });

    describe("runOnToolError", () => {
      it("calls onToolError hook when defined", async () => {
        const hook = vi.fn();
        const hooks: LlmHooks = { onToolError: hook };
        const context = {
          args: '{"key": "value"}',
          error: new Error("Tool failed"),
          toolName: "myTool",
        };

        await runner.runOnToolError(hooks, context);

        expect(hook).toHaveBeenCalledWith(context);
      });

      it("does nothing when hook is undefined", async () => {
        const hooks: LlmHooks = {};
        const context = {
          args: '{"key": "value"}',
          error: new Error("Tool failed"),
          toolName: "myTool",
        };

        await expect(
          runner.runOnToolError(hooks, context),
        ).resolves.toBeUndefined();
      });
    });

    describe("runOnRetryableError", () => {
      it("calls onRetryableModelError hook when defined", async () => {
        const hook = vi.fn();
        const hooks: LlmHooks = { onRetryableModelError: hook };
        const context = {
          error: new Error("Retryable error"),
          input: "test",
          options: {},
          providerRequest: {},
        };

        await runner.runOnRetryableError(hooks, context);

        expect(hook).toHaveBeenCalledWith(context);
      });

      it("does nothing when hook is undefined", async () => {
        const hooks: LlmHooks = {};
        const context = {
          error: new Error("Retryable error"),
          input: "test",
          options: {},
          providerRequest: {},
        };

        await expect(
          runner.runOnRetryableError(hooks, context),
        ).resolves.toBeUndefined();
      });
    });

    describe("runOnUnrecoverableError", () => {
      it("calls onUnrecoverableModelError hook when defined", async () => {
        const hook = vi.fn();
        const hooks: LlmHooks = { onUnrecoverableModelError: hook };
        const context = {
          error: new Error("Fatal error"),
          input: "test",
          options: {},
          providerRequest: {},
        };

        await runner.runOnUnrecoverableError(hooks, context);

        expect(hook).toHaveBeenCalledWith(context);
      });

      it("does nothing when hook is undefined", async () => {
        const hooks: LlmHooks = {};
        const context = {
          error: new Error("Fatal error"),
          input: "test",
          options: {},
          providerRequest: {},
        };

        await expect(
          runner.runOnUnrecoverableError(hooks, context),
        ).resolves.toBeUndefined();
      });
    });
  });

  // Features
  describe("Features", () => {
    let runner: HookRunner;

    beforeEach(() => {
      runner = new HookRunner();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("handles async hooks", async () => {
      const asyncHook = vi.fn().mockResolvedValue("result");
      const hooks: LlmHooks = { beforeEachTool: asyncHook };
      const context = {
        args: "{}",
        toolName: "asyncTool",
      };

      await runner.runBeforeTool(hooks, context);

      expect(asyncHook).toHaveBeenCalledWith(context);
    });

    it("handles sync hooks", async () => {
      const syncHook = vi.fn().mockReturnValue("result");
      const hooks: LlmHooks = { beforeEachTool: syncHook };
      const context = {
        args: "{}",
        toolName: "syncTool",
      };

      await runner.runBeforeTool(hooks, context);

      expect(syncHook).toHaveBeenCalledWith(context);
    });
  });
});

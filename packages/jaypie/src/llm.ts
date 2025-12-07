import { loadPackage } from "./loadPackage.js";
import type * as LlmTypes from "@jaypie/llm";

type LlmModule = typeof LlmTypes;

// Re-export types (these don't require the package at runtime)
export type {
  LlmHistory,
  LlmInputContent,
  LlmInputContentFile,
  LlmInputContentImage,
  LlmInputContentText,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmOptions,
  LlmProvider,
  LlmTool,
} from "@jaypie/llm";

// Re-export enums via getters
export const LlmMessageRole: typeof LlmTypes.LlmMessageRole = new Proxy(
  {} as typeof LlmTypes.LlmMessageRole,
  {
    get(_, prop) {
      return loadPackage<LlmModule>("@jaypie/llm").LlmMessageRole[
        prop as keyof typeof LlmTypes.LlmMessageRole
      ];
    },
  },
);

export const LlmMessageType: typeof LlmTypes.LlmMessageType = new Proxy(
  {} as typeof LlmTypes.LlmMessageType,
  {
    get(_, prop) {
      return loadPackage<LlmModule>("@jaypie/llm").LlmMessageType[
        prop as keyof typeof LlmTypes.LlmMessageType
      ];
    },
  },
);

// Re-export LLM constants namespace via getter
export const LLM: typeof LlmTypes.LLM = new Proxy({} as typeof LlmTypes.LLM, {
  get(_, prop) {
    return loadPackage<LlmModule>("@jaypie/llm").LLM[
      prop as keyof typeof LlmTypes.LLM
    ];
  },
});

// Llm class wrapper
export const Llm: typeof LlmTypes.Llm = new Proxy(
  function () {} as unknown as typeof LlmTypes.Llm,
  {
    construct(_, args) {
      const LlmClass = loadPackage<LlmModule>("@jaypie/llm").Llm;
      return new LlmClass(...(args as ConstructorParameters<typeof LlmClass>));
    },
    get(_, prop) {
      const LlmClass = loadPackage<LlmModule>("@jaypie/llm")
        .Llm as unknown as Record<string, unknown>;
      return LlmClass[prop as string];
    },
  },
);

// Toolkit exports
export const JaypieToolkit: typeof LlmTypes.JaypieToolkit = new Proxy(
  function () {} as unknown as typeof LlmTypes.JaypieToolkit,
  {
    construct(_, args) {
      const ToolkitClass = loadPackage<LlmModule>("@jaypie/llm").JaypieToolkit;
      return new ToolkitClass(
        ...(args as ConstructorParameters<typeof ToolkitClass>),
      );
    },
    get(_, prop) {
      const ToolkitClass = loadPackage<LlmModule>("@jaypie/llm")
        .JaypieToolkit as unknown as Record<string, unknown>;
      return ToolkitClass[prop as string];
    },
  },
);

export const Toolkit: typeof LlmTypes.Toolkit = new Proxy(
  function () {} as unknown as typeof LlmTypes.Toolkit,
  {
    construct(_, args) {
      const ToolkitClass = loadPackage<LlmModule>("@jaypie/llm").Toolkit;
      return new ToolkitClass(
        ...(args as ConstructorParameters<typeof ToolkitClass>),
      );
    },
    get(_, prop) {
      const ToolkitClass = loadPackage<LlmModule>("@jaypie/llm")
        .Toolkit as unknown as Record<string, unknown>;
      return ToolkitClass[prop as string];
    },
  },
);

// toolkit and tools are objects/instances
export const toolkit: typeof LlmTypes.toolkit = new Proxy(
  {} as typeof LlmTypes.toolkit,
  {
    get(_, prop) {
      const toolkitObj = loadPackage<LlmModule>("@jaypie/llm")
        .toolkit as unknown as Record<string, unknown>;
      return toolkitObj[prop as string];
    },
  },
);

export const tools: typeof LlmTypes.tools = new Proxy(
  {} as typeof LlmTypes.tools,
  {
    get(_, prop) {
      const toolsObj = loadPackage<LlmModule>("@jaypie/llm")
        .tools as unknown as Record<string, unknown>;
      return toolsObj[prop as string];
    },
  },
);

// Provider exports
export const GeminiProvider: typeof LlmTypes.GeminiProvider = new Proxy(
  function () {} as unknown as typeof LlmTypes.GeminiProvider,
  {
    construct(_, args) {
      const ProviderClass =
        loadPackage<LlmModule>("@jaypie/llm").GeminiProvider;
      return new ProviderClass(
        ...(args as ConstructorParameters<typeof ProviderClass>),
      );
    },
    get(_, prop) {
      const ProviderClass = loadPackage<LlmModule>("@jaypie/llm")
        .GeminiProvider as unknown as Record<string, unknown>;
      return ProviderClass[prop as string];
    },
  },
);

export const OpenRouterProvider: typeof LlmTypes.OpenRouterProvider = new Proxy(
  function () {} as unknown as typeof LlmTypes.OpenRouterProvider,
  {
    construct(_, args) {
      const ProviderClass =
        loadPackage<LlmModule>("@jaypie/llm").OpenRouterProvider;
      return new ProviderClass(
        ...(args as ConstructorParameters<typeof ProviderClass>),
      );
    },
    get(_, prop) {
      const ProviderClass = loadPackage<LlmModule>("@jaypie/llm")
        .OpenRouterProvider as unknown as Record<string, unknown>;
      return ProviderClass[prop as string];
    },
  },
);

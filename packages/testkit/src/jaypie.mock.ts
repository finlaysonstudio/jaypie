import { getMessages as originalGetMessages } from "@jaypie/aws";
import {
  force,
  Log,
  uuid as originalUuid,
  validate as originalValidate,
  // Core utilities
  HTTP,
  JAYPIE,
  log,
  // Errors
  BadGatewayError as BadGatewayErrorOriginal,
  BadRequestError as BadRequestErrorOriginal,
  ConfigurationError as ConfigurationErrorOriginal,
  ForbiddenError as ForbiddenErrorOriginal,
  GatewayTimeoutError as GatewayTimeoutErrorOriginal,
  GoneError as GoneErrorOriginal,
  IllogicalError as IllogicalErrorOriginal,
  InternalError as InternalErrorOriginal,
  MethodNotAllowedError as MethodNotAllowedErrorOriginal,
  MultiError as MultiErrorOriginal,
  NotFoundError as NotFoundErrorOriginal,
  NotImplementedError as NotImplementedErrorOriginal,
  ProjectError as ProjectErrorOriginal,
  ProjectMultiError as ProjectMultiErrorOriginal,
  RejectedError as RejectedErrorOriginal,
  TeapotError as TeapotErrorOriginal,
  UnauthorizedError as UnauthorizedErrorOriginal,
  UnavailableError as UnavailableErrorOriginal,
  UnhandledError as UnhandledErrorOriginal,
  UnreachableCodeError as UnreachableCodeErrorOriginal,
} from "@jaypie/core";
import { mongoose } from "@jaypie/mongoose";
import type { TextractPageAdaptable } from "@jaypie/textract";
import type { JsonReturn } from "@jaypie/types";
import { beforeAll, vi } from "vitest";

import {
  ExpressHandlerFunction,
  ExpressHandlerOptions,
  ExpressHandlerParameter,
  GenericArgs,
  JaypieHandlerFunction,
  JaypieHandlerOptions,
  JaypieHandlerParameter,
  JaypieLifecycleOption,
  WithJsonFunction,
} from "./types/jaypie-testkit";
import type { SQSMessageResponse } from "@jaypie/aws";
import { spyLog } from "./mockLog.module.js";
import type { Response as ExpressResponse } from "express";
import { readFile } from "fs/promises";
import { TextractDocument } from "amazon-textract-response-parser";
import { MarkdownPage as OriginalMarkdownPage } from "@jaypie/textract";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import originalPlaceholders from "./placeholders.js";

//
//
// Setup
//

const TAG = JAYPIE.LIB.TESTKIT;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MOCK_TEXTRACT_DOCUMENT_PATH = join(__dirname, "mockTextract.json");

let textractJsonToMarkdownOriginal = vi.fn<typeof textractJsonToMarkdown>();
let MarkdownPageOriginal: typeof OriginalMarkdownPage;
let mockTextractContents: string;

// Spy on log:
beforeAll(async () => {
  const textract =
    await vi.importActual<typeof import("@jaypie/textract")>(
      "@jaypie/textract",
    );
  textractJsonToMarkdownOriginal.mockImplementation(
    textract.textractJsonToMarkdown,
  );
  MarkdownPageOriginal = textract.MarkdownPage;
  mockTextractContents = await readFile(MOCK_TEXTRACT_DOCUMENT_PATH, "utf-8");
  spyLog(log as Log);
});

//
//
// Mock Functions
//

// @jaypie/aws
const getEnvSecret = vi.fn((): string => {
  return `_MOCK_ENV_SECRET_[${TAG}]`;
});

const getMessages = vi.fn((...params: Parameters<typeof originalGetMessages>) =>
  originalGetMessages(...params),
);

const getSecret = vi.fn((): string => {
  return `_MOCK_SECRET_[${TAG}]`;
});

const getTextractJob = vi.fn((job: string): SQSMessageResponse => {
  return { value: `_MOCK_TEXTRACT_JOB_[${job}]` };
});

const sendBatchMessages = vi.fn((): SQSMessageResponse => {
  return { value: `_MOCK_BATCH_MESSAGES_[${TAG}]` };
});

const sendMessage = vi.fn((): SQSMessageResponse => {
  return { value: `_MOCK_MESSAGE_[${TAG}]` };
});

const sendTextractJob = vi.fn(({ key, bucket }): Array<unknown> => {
  if (!key || !bucket) {
    throw new ConfigurationError("[sendTextractJob] Missing key or bucket");
  }
  return [`_MOCK_TEXTRACT_JOB_[${bucket}/${key}]`];
});

// @jaypie/core Errors
const BadGatewayError = vi.fn(
  (
    ...params: ConstructorParameters<typeof BadGatewayErrorOriginal>
  ): InstanceType<typeof BadGatewayErrorOriginal> => {
    return new BadGatewayErrorOriginal(...params);
  },
);

const BadRequestError = vi.fn(
  (
    ...params: ConstructorParameters<typeof BadRequestErrorOriginal>
  ): InstanceType<typeof BadRequestErrorOriginal> => {
    return new BadRequestErrorOriginal(...params);
  },
);

const ConfigurationError = vi.fn(
  (
    ...params: ConstructorParameters<typeof ConfigurationErrorOriginal>
  ): InstanceType<typeof ConfigurationErrorOriginal> => {
    return new ConfigurationErrorOriginal(...params);
  },
);

// Complete the error mocks
const ForbiddenError = vi.fn(
  (
    ...params: ConstructorParameters<typeof ForbiddenErrorOriginal>
  ): InstanceType<typeof ForbiddenErrorOriginal> => {
    return new ForbiddenErrorOriginal(...params);
  },
);

const GatewayTimeoutError = vi.fn(
  (
    ...params: ConstructorParameters<typeof GatewayTimeoutErrorOriginal>
  ): InstanceType<typeof GatewayTimeoutErrorOriginal> => {
    return new GatewayTimeoutErrorOriginal(...params);
  },
);

const GoneError = vi.fn(
  (
    ...params: ConstructorParameters<typeof GoneErrorOriginal>
  ): InstanceType<typeof GoneErrorOriginal> => {
    return new GoneErrorOriginal(...params);
  },
);

const IllogicalError = vi.fn(
  (
    ...params: ConstructorParameters<typeof IllogicalErrorOriginal>
  ): InstanceType<typeof IllogicalErrorOriginal> => {
    return new IllogicalErrorOriginal(...params);
  },
);

const InternalError = vi.fn(
  (
    ...params: ConstructorParameters<typeof InternalErrorOriginal>
  ): InstanceType<typeof InternalErrorOriginal> => {
    return new InternalErrorOriginal(...params);
  },
);

const MethodNotAllowedError = vi.fn(
  (
    ...params: ConstructorParameters<typeof MethodNotAllowedErrorOriginal>
  ): InstanceType<typeof MethodNotAllowedErrorOriginal> => {
    return new MethodNotAllowedErrorOriginal(...params);
  },
);

const MultiError = vi.fn(
  (
    ...params: ConstructorParameters<typeof MultiErrorOriginal>
  ): InstanceType<typeof MultiErrorOriginal> => {
    return new MultiErrorOriginal(...params);
  },
);

const NotFoundError = vi.fn(
  (
    ...params: ConstructorParameters<typeof NotFoundErrorOriginal>
  ): InstanceType<typeof NotFoundErrorOriginal> => {
    return new NotFoundErrorOriginal(...params);
  },
);

const NotImplementedError = vi.fn(
  (
    ...params: ConstructorParameters<typeof NotImplementedErrorOriginal>
  ): InstanceType<typeof NotImplementedErrorOriginal> => {
    return new NotImplementedErrorOriginal(...params);
  },
);

const ProjectError = vi.fn(
  (
    ...params: ConstructorParameters<typeof ProjectErrorOriginal>
  ): InstanceType<typeof ProjectErrorOriginal> => {
    return new ProjectErrorOriginal(...params);
  },
);

const ProjectMultiError = vi.fn(
  (
    ...params: ConstructorParameters<typeof ProjectMultiErrorOriginal>
  ): InstanceType<typeof ProjectMultiErrorOriginal> => {
    return new ProjectMultiErrorOriginal(...params);
  },
);

const RejectedError = vi.fn(
  (
    ...params: ConstructorParameters<typeof RejectedErrorOriginal>
  ): InstanceType<typeof RejectedErrorOriginal> => {
    return new RejectedErrorOriginal(...params);
  },
);

const TeapotError = vi.fn(
  (
    ...params: ConstructorParameters<typeof TeapotErrorOriginal>
  ): InstanceType<typeof TeapotErrorOriginal> => {
    return new TeapotErrorOriginal(...params);
  },
);

const UnauthorizedError = vi.fn(
  (
    ...params: ConstructorParameters<typeof UnauthorizedErrorOriginal>
  ): InstanceType<typeof UnauthorizedErrorOriginal> => {
    return new UnauthorizedErrorOriginal(...params);
  },
);

const UnavailableError = vi.fn(
  (
    ...params: ConstructorParameters<typeof UnavailableErrorOriginal>
  ): InstanceType<typeof UnavailableErrorOriginal> => {
    return new UnavailableErrorOriginal(...params);
  },
);

const UnhandledError = vi.fn(
  (
    ...params: ConstructorParameters<typeof UnhandledErrorOriginal>
  ): InstanceType<typeof UnhandledErrorOriginal> => {
    return new UnhandledErrorOriginal(...params);
  },
);

const UnreachableCodeError = vi.fn(
  (
    ...params: ConstructorParameters<typeof UnreachableCodeErrorOriginal>
  ): InstanceType<typeof UnreachableCodeErrorOriginal> => {
    return new UnreachableCodeErrorOriginal(...params);
  },
);

// @jaypie/core Functions
const envBoolean = vi.fn((): boolean => {
  return true;
});

const placeholders = vi.fn(
  (...params: Parameters<typeof originalPlaceholders>) =>
    originalPlaceholders(...params),
);

const jaypieHandler = vi.fn(
  (
    handler: JaypieHandlerFunction,
    {
      setup = [] as JaypieLifecycleOption,
      teardown = [] as JaypieLifecycleOption,
      unavailable = force.boolean(process.env.PROJECT_UNAVAILABLE),
      validate = [] as JaypieLifecycleOption,
    }: JaypieHandlerOptions = {},
  ) => {
    return async (...args: GenericArgs) => {
      let result;
      let thrownError;
      if (unavailable) throw UnavailableError();
      validate = force.array(validate);
      for (const validator of validate) {
        if (typeof validator === "function") {
          const valid = await validator(...args);
          if (valid === false) {
            throw new BadRequestError();
          }
        }
      }
      try {
        setup = force.array(setup);
        for (const setupFunction of setup) {
          if (typeof setupFunction === "function") {
            await setupFunction(...args);
          }
        }
        // @ts-expect-error TODO: cannot resolve; fix when JaypieHandler moves to TypeScript
        result = handler(...args);
      } catch (error) {
        thrownError = error;
      }
      teardown = force.array(teardown);
      for (const teardownFunction of teardown) {
        if (typeof teardownFunction === "function") {
          try {
            await teardownFunction(...args);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        }
      }
      if (thrownError) {
        throw thrownError;
      }
      return result;
    };
  },
);

const sleep = vi.fn((): boolean => {
  return true;
});

const uuid = vi.fn(originalUuid);

// @jaypie/core validate
const validate = vi.fn(
  (
    ...params: Parameters<typeof originalValidate>
  ): ReturnType<typeof originalValidate> => {
    return originalValidate(...params);
  },
);

// Set up convenience functions to match original validate
validate.array = vi.fn(
  (
    ...params: Parameters<typeof originalValidate.array>
  ): ReturnType<typeof originalValidate.array> => {
    return originalValidate.array(...params);
  },
);
validate.boolean = vi.fn(
  (
    ...params: Parameters<typeof originalValidate.boolean>
  ): ReturnType<typeof originalValidate.boolean> => {
    return originalValidate.boolean(...params);
  },
);
validate.class = vi.fn(
  (
    ...params: Parameters<typeof originalValidate.class>
  ): ReturnType<typeof originalValidate.class> => {
    return originalValidate.class(...params);
  },
);
validate.function = vi.fn(
  (
    ...params: Parameters<typeof originalValidate.function>
  ): ReturnType<typeof originalValidate.function> => {
    return originalValidate.function(...params);
  },
);
validate.null = vi.fn(
  (
    ...params: Parameters<typeof originalValidate.null>
  ): ReturnType<typeof originalValidate.null> => {
    return originalValidate.null(...params);
  },
);
validate.number = vi.fn(
  (
    ...params: Parameters<typeof originalValidate.number>
  ): ReturnType<typeof originalValidate.number> => {
    return originalValidate.number(...params);
  },
);
validate.object = vi.fn(
  (
    ...params: Parameters<typeof originalValidate.object>
  ): ReturnType<typeof originalValidate.object> => {
    return originalValidate.object(...params);
  },
);
validate.string = vi.fn(
  (
    ...params: Parameters<typeof originalValidate.string>
  ): ReturnType<typeof originalValidate.string> => {
    return originalValidate.string(...params);
  },
);
validate.undefined = vi.fn(
  (
    ...params: Parameters<typeof originalValidate.undefined>
  ): ReturnType<typeof originalValidate.undefined> => {
    return originalValidate.undefined(...params);
  },
);

// Set up optional functions
validate.optional = {
  array: vi.fn(
    (
      ...params: Parameters<typeof originalValidate.optional.array>
    ): ReturnType<typeof originalValidate.optional.array> => {
      return originalValidate.optional.array(...params);
    },
  ),
  boolean: vi.fn(
    (
      ...params: Parameters<typeof originalValidate.optional.boolean>
    ): ReturnType<typeof originalValidate.optional.boolean> => {
      return originalValidate.optional.boolean(...params);
    },
  ),
  class: vi.fn(
    (
      ...params: Parameters<typeof originalValidate.optional.class>
    ): ReturnType<typeof originalValidate.optional.class> => {
      return originalValidate.optional.class(...params);
    },
  ),
  function: vi.fn(
    (
      ...params: Parameters<typeof originalValidate.optional.function>
    ): ReturnType<typeof originalValidate.optional.function> => {
      return originalValidate.optional.function(...params);
    },
  ),
  null: vi.fn(
    (
      ...params: Parameters<typeof originalValidate.optional.null>
    ): ReturnType<typeof originalValidate.optional.null> => {
      return originalValidate.optional.null(...params);
    },
  ),
  number: vi.fn(
    (
      ...params: Parameters<typeof originalValidate.optional.number>
    ): ReturnType<typeof originalValidate.optional.number> => {
      return originalValidate.optional.number(...params);
    },
  ),
  object: vi.fn(
    (
      ...params: Parameters<typeof originalValidate.optional.object>
    ): ReturnType<typeof originalValidate.optional.object> => {
      return originalValidate.optional.object(...params);
    },
  ),
  string: vi.fn(
    (
      ...params: Parameters<typeof originalValidate.optional.string>
    ): ReturnType<typeof originalValidate.optional.string> => {
      return originalValidate.optional.string(...params);
    },
  ),
};

// @jaypie/datadog
const submitMetric = vi.fn((): boolean => {
  return true;
});

const submitMetricSet = vi.fn((): boolean => {
  return true;
});

// @jaypie/express
const expressHandler = vi.fn(
  (
    handlerOrProps: ExpressHandlerParameter,
    propsOrHandler?: ExpressHandlerParameter,
  ) => {
    let handler: ExpressHandlerFunction;
    let props: ExpressHandlerOptions;

    if (
      typeof handlerOrProps === "object" &&
      typeof propsOrHandler === "function"
    ) {
      handler = propsOrHandler;
      props = handlerOrProps;
    } else if (typeof handlerOrProps === "function") {
      handler = handlerOrProps;
      props = (propsOrHandler || {}) as ExpressHandlerOptions;
    } else {
      throw BadRequestError("handler must be a function");
    }

    // Add locals setup if needed
    if (
      props.locals &&
      typeof props.locals === "object" &&
      !Array.isArray(props.locals)
    ) {
      const keys = Object.keys(props.locals);
      if (!props.setup) props.setup = [];
      props.setup = force.array(props.setup);
      // @ts-expect-error TODO: cannot resolve; fix when JaypieHandler moves to TypeScript
      props.setup.unshift((req: { locals?: Record<string, unknown> }) => {
        if (!req || typeof req !== "object") {
          throw new BadRequestError("req must be an object");
        }
        // Set req.locals if it doesn't exist
        if (!req.locals) req.locals = {};
        if (typeof req.locals !== "object" || Array.isArray(req.locals)) {
          throw new BadRequestError("req.locals must be an object");
        }
        if (!req.locals._jaypie) req.locals._jaypie = {};
      });
      const localsSetup = async (
        localsReq: { locals: Record<string, unknown> },
        localsRes: unknown,
      ) => {
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          if (typeof props.locals![key] === "function") {
            localsReq.locals[key] = await props.locals![key](
              localsReq,
              localsRes,
            );
          } else {
            localsReq.locals[key] = props.locals![key];
          }
        }
      };
      // @ts-expect-error TODO: cannot resolve; fix when JaypieHandler moves to TypeScript
      props.setup.push(localsSetup);
    }
    if (props.locals && typeof props.locals !== "object") {
      throw new BadRequestError("props.locals must be an object");
    }
    if (props.locals && Array.isArray(props.locals)) {
      throw new BadRequestError("props.locals must be an object");
    }
    if (props.locals === null) {
      throw new BadRequestError("props.locals must be an object");
    }

    const jaypieFunction = jaypieHandler(handler, props);
    return async (req = {}, res = {}, ...extra: unknown[]) => {
      const status = HTTP.CODE.OK;
      let response;
      let supertestMode = false;

      if (
        res &&
        typeof res === "object" &&
        "socket" in res &&
        res.constructor.name === "ServerResponse"
      ) {
        // Use the response object in supertest mode
        supertestMode = true;
      }

      try {
        response = await jaypieFunction(req, res, ...extra);
      } catch (error) {
        // In the mock context, if status is a function we are in a "supertest"
        if (
          supertestMode &&
          typeof (res as ExpressResponse).status === "function"
        ) {
          // In theory jaypieFunction has handled all errors
          const errorStatus =
            (error as ProjectErrorOriginal).status ||
            HTTP.CODE.INTERNAL_SERVER_ERROR;
          let errorResponse;
          if (typeof (error as ProjectErrorOriginal).json === "function") {
            errorResponse = (error as ProjectErrorOriginal).json();
          } else {
            // This should never happen
            errorResponse = UnhandledError().json();
          }
          (res as ExpressResponse).status(errorStatus).json(errorResponse);
          return;
        } else {
          // else, res.status is not a function, throw the error
          throw error;
        }
      }

      if (
        supertestMode &&
        typeof (res as ExpressResponse).status === "function"
      ) {
        if (response) {
          if (typeof response === "object") {
            if (typeof (response as WithJsonFunction).json === "function") {
              (res as ExpressResponse).json(
                (response as WithJsonFunction).json(),
              );
            } else {
              (res as ExpressResponse).status(status).json(response);
            }
          } else if (typeof response === "string") {
            try {
              (res as ExpressResponse)
                .status(status)
                .json(JSON.parse(response));
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
              (res as ExpressResponse).status(status).send(response);
            }
          } else if (response === true) {
            (res as ExpressResponse).status(HTTP.CODE.CREATED).send();
          } else {
            (res as ExpressResponse).status(status).send(response);
          }
        } else {
          (res as ExpressResponse).status(HTTP.CODE.NO_CONTENT).send();
        }
      } else {
        return response;
      }
    };
  },
);

// @jaypie/lambda
const lambdaHandler = vi.fn(
  (handler: JaypieHandlerParameter, props: JaypieHandlerParameter = {}) => {
    // If handler is an object and options is a function, swap them
    if (typeof handler === "object" && typeof props === "function") {
      const temp = handler;
      handler = props;
      props = temp;
    }
    return async (event: unknown, context: unknown, ...extra: unknown[]) => {
      return jaypieHandler(
        handler as JaypieHandlerFunction,
        props as JaypieHandlerOptions,
      )(event, context, ...extra);
    };
  },
);

// @jaypie/llm
const mockOperate = vi.fn().mockResolvedValue({
  history: [
    {
      content: "_MOCK_USER_INPUT",
      role: "user",
      type: "message",
    },
    {
      id: "_MOCK_MESSAGE_ID",
      type: "message",
      status: "completed",
      content: "_MOCK_CONTENT",
      role: "assistant",
    },
  ],
  output: [
    {
      id: "_MOCK_MESSAGE_ID",
      type: "message",
      status: "completed",
      content: "_MOCK_CONTENT",
      role: "assistant",
    },
  ],
  responses: [
    {
      id: "_MOCK_RESPONSE_ID",
      object: "response",
      created_at: Date.now() / 1000,
      status: "completed",
      error: null,
      output_text: "_MOCK_OUTPUT_TEXT",
    },
  ],
  status: "completed",
  usage: { input: 100, output: 20, reasoning: 0, total: 120 },
  content: "_MOCK_OUTPUT_TEXT",
});
const mockSend = vi.fn().mockResolvedValue("_MOCK_LLM_RESPONSE");
const Llm = Object.assign(
  vi.fn().mockImplementation((providerName = "_MOCK_LLM_PROVIDER") => ({
    _provider: providerName,
    _llm: {
      operate: mockOperate,
      send: mockSend,
    },
    operate: mockOperate,
    send: mockSend,
  })),
  {
    operate: mockOperate,
    send: mockSend,
  },
);

// @jaypie/mongoose
const connect = vi.fn((): boolean => {
  return true;
});

const connectFromSecretEnv = vi.fn((): boolean => {
  return true;
});

const disconnect = vi.fn((): boolean => {
  return true;
});

// @jaypie/textract
const MarkdownPage = vi
  .fn()
  .mockImplementation((page: TextractPageAdaptable) => {
    try {
      return new MarkdownPageOriginal(page);
    } catch {
      // eslint-disable-next-line no-console
      console.warn(
        "[MarkdownPage] Actual implementation failed. To suppress this warning, manually mock the response with mockReturnValue",
      );
      const mockDocument = new TextractDocument(
        JSON.parse(mockTextractContents),
      );
      // Double type assertion needed to bridge incompatible types
      return new MarkdownPageOriginal(
        mockDocument._pages[0] as unknown as TextractPageAdaptable,
      );
    }
  });

const textractJsonToMarkdown = vi.fn((textractResults: JsonReturn): string => {
  try {
    const result = textractJsonToMarkdownOriginal(textractResults);
    return result;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[textractJsonToMarkdown] Actual implementation failed. To suppress this warning, manually mock the response with mockReturnValue",
    );
    return `_MOCK_TEXTRACT_JSON_TO_MARKDOWN_{{${textractResults}}}`;
  }
});

// Export default for convenience
export default {
  // AWS
  getEnvSecret,
  getMessages,
  getSecret,
  getTextractJob,
  sendBatchMessages,
  sendMessage,
  sendTextractJob,
  // Core
  BadGatewayError,
  BadRequestError,
  ConfigurationError,
  envBoolean,
  ForbiddenError,
  GatewayTimeoutError,
  GoneError,
  HTTP,
  IllogicalError,
  InternalError,
  jaypieHandler,
  log,
  MethodNotAllowedError,
  MultiError,
  NotFoundError,
  NotImplementedError,
  placeholders,
  ProjectError,
  ProjectMultiError,
  RejectedError,
  sleep,
  TeapotError,
  UnauthorizedError,
  UnavailableError,
  UnhandledError,
  UnreachableCodeError,
  uuid,
  validate,
  // Datadog
  submitMetric,
  submitMetricSet,
  // Express
  expressHandler,
  // Lambda
  lambdaHandler,
  // LLM
  Llm,
  // Mongoose
  connect,
  connectFromSecretEnv,
  disconnect,
  mongoose,
  // Textract
  MarkdownPage,
  textractJsonToMarkdown,
};

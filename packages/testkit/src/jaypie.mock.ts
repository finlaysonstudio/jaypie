/* eslint-disable import-x/export */
import { getMessages as originalGetMessages } from "@jaypie/aws";
import {
  force,
  Log,
  uuid as originalUuid,
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

//
//
// Setup
//

const TAG = JAYPIE.LIB.TESTKIT;

// Export all the modules from Jaypie packages:
export * from "@jaypie/aws";
export * from "@jaypie/core";
export * from "@jaypie/express";
export * from "@jaypie/datadog";
export * from "@jaypie/lambda";
export * from "@jaypie/mongoose";

// Spy on log:
beforeAll(() => {
  spyLog(log as Log);
});

//
//
// Mock Functions
//

// @jaypie/aws
export const getEnvSecret = vi.fn((): string => {
  return `_MOCK_ENV_SECRET_[${TAG}]`;
});

export const getMessages = vi.fn(
  (...params: Parameters<typeof originalGetMessages>) =>
    originalGetMessages(...params),
);

export const getSecret = vi.fn((): string => {
  return `_MOCK_SECRET_[${TAG}]`;
});

export const getTextractJob = vi.fn((job: string): SQSMessageResponse => {
  return { value: `_MOCK_TEXTRACT_JOB_[${job}]` };
});

export const sendBatchMessages = vi.fn((): SQSMessageResponse => {
  return { value: `_MOCK_BATCH_MESSAGES_[${TAG}]` };
});

export const sendMessage = vi.fn((): SQSMessageResponse => {
  return { value: `_MOCK_MESSAGE_[${TAG}]` };
});

export const sendTextractJob = vi.fn(({ key, bucket }): Array<unknown> => {
  if (!key || !bucket) {
    throw new ConfigurationError("[sendTextractJob] Missing key or bucket");
  }
  return [`_MOCK_TEXTRACT_JOB_[${bucket}/${key}]`];
});

// @jaypie/core Errors
export const BadGatewayError = vi.fn(
  (
    ...params: ConstructorParameters<typeof BadGatewayErrorOriginal>
  ): InstanceType<typeof BadGatewayErrorOriginal> => {
    return new BadGatewayErrorOriginal(...params);
  },
);

export const BadRequestError = vi.fn(
  (
    ...params: ConstructorParameters<typeof BadRequestErrorOriginal>
  ): InstanceType<typeof BadRequestErrorOriginal> => {
    return new BadRequestErrorOriginal(...params);
  },
);

export const ConfigurationError = vi.fn(
  (
    ...params: ConstructorParameters<typeof ConfigurationErrorOriginal>
  ): InstanceType<typeof ConfigurationErrorOriginal> => {
    return new ConfigurationErrorOriginal(...params);
  },
);

// @jaypie/core Functions
export const envBoolean = vi.fn((): boolean => {
  return true;
});

export const jaypieHandler = vi.fn(
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

export const sleep = vi.fn((): boolean => {
  return true;
});

export const uuid = vi.fn(originalUuid);

// @jaypie/datadog
export const submitMetric = vi.fn((): boolean => {
  return true;
});

export const submitMetricSet = vi.fn((): boolean => {
  return true;
});

// @jaypie/express
export const expressHandler = vi.fn(
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

// @jaypie/mongoose
export const connect = vi.fn((): boolean => {
  return true;
});

export const connectFromSecretEnv = vi.fn((): boolean => {
  return true;
});

export const disconnect = vi.fn((): boolean => {
  return true;
});

// Complete the error mocks
export const ForbiddenError = vi.fn(
  (
    ...params: ConstructorParameters<typeof ForbiddenErrorOriginal>
  ): InstanceType<typeof ForbiddenErrorOriginal> => {
    return new ForbiddenErrorOriginal(...params);
  },
);

export const GatewayTimeoutError = vi.fn(
  (
    ...params: ConstructorParameters<typeof GatewayTimeoutErrorOriginal>
  ): InstanceType<typeof GatewayTimeoutErrorOriginal> => {
    return new GatewayTimeoutErrorOriginal(...params);
  },
);

export const GoneError = vi.fn(
  (
    ...params: ConstructorParameters<typeof GoneErrorOriginal>
  ): InstanceType<typeof GoneErrorOriginal> => {
    return new GoneErrorOriginal(...params);
  },
);

export const IllogicalError = vi.fn(
  (
    ...params: ConstructorParameters<typeof IllogicalErrorOriginal>
  ): InstanceType<typeof IllogicalErrorOriginal> => {
    return new IllogicalErrorOriginal(...params);
  },
);

export const InternalError = vi.fn(
  (
    ...params: ConstructorParameters<typeof InternalErrorOriginal>
  ): InstanceType<typeof InternalErrorOriginal> => {
    return new InternalErrorOriginal(...params);
  },
);

export const MethodNotAllowedError = vi.fn(
  (
    ...params: ConstructorParameters<typeof MethodNotAllowedErrorOriginal>
  ): InstanceType<typeof MethodNotAllowedErrorOriginal> => {
    return new MethodNotAllowedErrorOriginal(...params);
  },
);

export const MultiError = vi.fn(
  (
    ...params: ConstructorParameters<typeof MultiErrorOriginal>
  ): InstanceType<typeof MultiErrorOriginal> => {
    return new MultiErrorOriginal(...params);
  },
);

export const NotFoundError = vi.fn(
  (
    ...params: ConstructorParameters<typeof NotFoundErrorOriginal>
  ): InstanceType<typeof NotFoundErrorOriginal> => {
    return new NotFoundErrorOriginal(...params);
  },
);

export const NotImplementedError = vi.fn(
  (
    ...params: ConstructorParameters<typeof NotImplementedErrorOriginal>
  ): InstanceType<typeof NotImplementedErrorOriginal> => {
    return new NotImplementedErrorOriginal(...params);
  },
);

export const ProjectError = vi.fn(
  (
    ...params: ConstructorParameters<typeof ProjectErrorOriginal>
  ): InstanceType<typeof ProjectErrorOriginal> => {
    return new ProjectErrorOriginal(...params);
  },
);

export const ProjectMultiError = vi.fn(
  (
    ...params: ConstructorParameters<typeof ProjectMultiErrorOriginal>
  ): InstanceType<typeof ProjectMultiErrorOriginal> => {
    return new ProjectMultiErrorOriginal(...params);
  },
);

export const RejectedError = vi.fn(
  (
    ...params: ConstructorParameters<typeof RejectedErrorOriginal>
  ): InstanceType<typeof RejectedErrorOriginal> => {
    return new RejectedErrorOriginal(...params);
  },
);

export const TeapotError = vi.fn(
  (
    ...params: ConstructorParameters<typeof TeapotErrorOriginal>
  ): InstanceType<typeof TeapotErrorOriginal> => {
    return new TeapotErrorOriginal(...params);
  },
);

export const UnauthorizedError = vi.fn(
  (
    ...params: ConstructorParameters<typeof UnauthorizedErrorOriginal>
  ): InstanceType<typeof UnauthorizedErrorOriginal> => {
    return new UnauthorizedErrorOriginal(...params);
  },
);

export const UnavailableError = vi.fn(
  (
    ...params: ConstructorParameters<typeof UnavailableErrorOriginal>
  ): InstanceType<typeof UnavailableErrorOriginal> => {
    return new UnavailableErrorOriginal(...params);
  },
);

export const UnhandledError = vi.fn(
  (
    ...params: ConstructorParameters<typeof UnhandledErrorOriginal>
  ): InstanceType<typeof UnhandledErrorOriginal> => {
    return new UnhandledErrorOriginal(...params);
  },
);

export const UnreachableCodeError = vi.fn(
  (
    ...params: ConstructorParameters<typeof UnreachableCodeErrorOriginal>
  ): InstanceType<typeof UnreachableCodeErrorOriginal> => {
    return new UnreachableCodeErrorOriginal(...params);
  },
);

// @jaypie/lambda
export const lambdaHandler = vi.fn(
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

// Export default for convenience
export default {
  // AWS
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
  MethodNotAllowedError,
  MultiError,
  NotFoundError,
  NotImplementedError,
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
  // Datadog
  submitMetric,
  submitMetricSet,
  // Express
  expressHandler,
  // Lambda
  lambdaHandler,
  // Mongoose
  connect,
  connectFromSecretEnv,
  disconnect,
};

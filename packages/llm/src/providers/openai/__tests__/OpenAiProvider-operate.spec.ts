import { getEnvSecret } from "@jaypie/aws";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  OpenAI,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { OpenAiProvider } from "../OpenAiProvider.class";
import { MAX_RETRIES_DEFAULT_LIMIT } from "../operate";
import { OpenAIResponse } from "../types";
import { LlmTool } from "../../../types/LlmTool.interface";

vi.mock("openai");

const MOCK = {
  RESPONSE: {
    CILANTRO: [
      {
        id: "resp_123",
        content: [{ text: "Cilantro is a good taco ingredient" }],
      },
    ],
  },
};

describe("OpenAiProvider.operate", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          responses: {
            create: vi.fn(),
          },
        }) as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-key");
  });

  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(OpenAiProvider).toBeClass();
      const provider = new OpenAiProvider();
      expect(provider).toBeInstanceOf(OpenAiProvider);
      expect(provider.operate).toBeFunction();
    });
    it("Works", async () => {
      const provider = new OpenAiProvider();
      const result = (await provider.operate("test")) as OpenAIResponse;
      expect(result).toBeArray();
    });
    it("Works how we expect", async () => {
      // Setup
      const mockResponse = MOCK.RESPONSE.CILANTRO;
      const mockCreate = vi.fn().mockResolvedValue(mockResponse[0]);
      vi.mocked(OpenAI).mockImplementation(
        () =>
          ({
            responses: {
              create: mockCreate,
            },
          }) as any,
      );
      // Execute
      const provider = new OpenAiProvider("mock-model");
      const testInput = "What is a good taco ingredient?";
      const result = await provider.operate(testInput);
      // Verify
      expect(result).toBeArray();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "mock-model",
        input: testInput,
      });
    });
  });

  describe("Features", () => {
    describe("User", () => {
      it("Passes user to OpenAI", async () => {
        // Setup
        const mockCreate = vi.fn();
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              responses: {
                create: mockCreate,
              },
            }) as any,
        );
        // Execute
        const provider = new OpenAiProvider();
        const testInput = "What is a good taco ingredient?";
        const result = await provider.operate(testInput, {
          user: "test-user",
        });
        // Verify
        expect(result).toBeArray();
        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockCreate).toHaveBeenCalledWith({
          model: expect.any(String),
          input: testInput,
          user: "test-user",
        });
      });
    });
    describe("API Retry", () => {
      it("Retries retryable errors up to the MAX_RETRIES_DEFAULT_LIMIT limit", async () => {
        // Setup
        const mockCreate = vi.fn();
        // First MAX_RETRIES_DEFAULT_LIMIT calls will fail with 500 errors
        for (let i = 0; i < MAX_RETRIES_DEFAULT_LIMIT; i++) {
          mockCreate.mockRejectedValueOnce(
            new InternalServerError(
              500,
              "Internal Server Error",
              undefined,
              {},
            ),
          );
        }
        // The next call will succeed
        const mockResponse = {
          id: "resp_123",
          content: [{ text: "Success after retries" }],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              responses: {
                create: mockCreate,
              },
            }) as any,
        );

        // Spy on sleep function to avoid waiting in tests
        const sleepSpy = vi
          .spyOn(await import("@jaypie/core"), "sleep")
          .mockResolvedValue(undefined);

        // Execute
        const provider = new OpenAiProvider();
        const result = (await provider.operate("test input")) as OpenAIResponse;

        // Verify
        expect(result).toBeArray();
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockResponse);

        // Verify the create function was called the expected number of times
        // MAX_RETRIES_DEFAULT_LIMIT failures + 1 success = MAX_RETRIES_DEFAULT_LIMIT + 1 total calls
        expect(mockCreate).toHaveBeenCalledTimes(MAX_RETRIES_DEFAULT_LIMIT + 1);

        // Verify sleep was called for each retry
        expect(sleepSpy).toHaveBeenCalledTimes(MAX_RETRIES_DEFAULT_LIMIT);

        // Clean up
        sleepSpy.mockRestore();
      });
      describe("Error Handling", () => {
        it("Throws BadGatewayError when retryable errors exceed limit", async () => {
          // Setup
          const mockCreate = vi.fn();
          // All calls will fail with 500 errors (exceeding the retry limit)
          for (let i = 0; i <= MAX_RETRIES_DEFAULT_LIMIT; i++) {
            mockCreate.mockRejectedValueOnce(
              new InternalServerError(
                500,
                "Internal Server Error",
                undefined,
                {},
              ),
            );
          }

          vi.mocked(OpenAI).mockImplementation(
            () =>
              ({
                responses: {
                  create: mockCreate,
                },
              }) as any,
          );

          // Spy on sleep function to avoid waiting in tests
          const sleepSpy = vi
            .spyOn(await import("@jaypie/core"), "sleep")
            .mockResolvedValue(undefined);

          // Execute
          const provider = new OpenAiProvider();

          // Verify
          await expect(provider.operate("test input")).rejects.toThrow();

          // Verify the create function was called the expected number of times
          // Should be called MAX_RETRIES_DEFAULT_LIMIT + 1 times (initial + retries)
          expect(mockCreate).toHaveBeenCalledTimes(
            MAX_RETRIES_DEFAULT_LIMIT + 1,
          );

          // Verify sleep was called for each retry
          expect(sleepSpy).toHaveBeenCalledTimes(MAX_RETRIES_DEFAULT_LIMIT);

          // Clean up
          sleepSpy.mockRestore();
        });
        describe("Not Retryable Errors", () => {
          it("Throws BadGatewayError non-retryable APIUserAbortError", async () => {
            // Setup
            const mockCreate = vi
              .fn()
              .mockRejectedValue(new APIUserAbortError());

            vi.mocked(OpenAI).mockImplementation(
              () =>
                ({
                  responses: {
                    create: mockCreate,
                  },
                }) as any,
            );

            // Execute
            const provider = new OpenAiProvider();

            // Verify
            await expect(provider.operate("test input")).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable AuthenticationError", async () => {
            // Setup
            const mockCreate = vi
              .fn()
              .mockRejectedValue(
                new AuthenticationError(
                  401,
                  "Authentication error",
                  undefined,
                  {},
                ),
              );

            vi.mocked(OpenAI).mockImplementation(
              () =>
                ({
                  responses: {
                    create: mockCreate,
                  },
                }) as any,
            );

            // Execute
            const provider = new OpenAiProvider();

            // Verify
            await expect(provider.operate("test input")).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });

          it("Throws BadGatewayError non-retryable BadRequestError", async () => {
            // Setup
            const mockCreate = vi
              .fn()
              .mockRejectedValue(
                new BadRequestError(400, "Bad request error", undefined, {}),
              );

            vi.mocked(OpenAI).mockImplementation(
              () =>
                ({
                  responses: {
                    create: mockCreate,
                  },
                }) as any,
            );

            // Execute
            const provider = new OpenAiProvider();

            // Verify
            await expect(provider.operate("test input")).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });

          it("Throws BadGatewayError non-retryable ConflictError", async () => {
            // Setup
            const mockCreate = vi
              .fn()
              .mockRejectedValue(
                new ConflictError(409, "Conflict error", undefined, {}),
              );

            vi.mocked(OpenAI).mockImplementation(
              () =>
                ({
                  responses: {
                    create: mockCreate,
                  },
                }) as any,
            );

            // Execute
            const provider = new OpenAiProvider();

            // Verify
            await expect(provider.operate("test input")).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });

          it("Throws BadGatewayError non-retryable NotFoundError", async () => {
            // Setup
            const mockCreate = vi
              .fn()
              .mockRejectedValue(
                new NotFoundError(404, "Not found error", undefined, {}),
              );

            vi.mocked(OpenAI).mockImplementation(
              () =>
                ({
                  responses: {
                    create: mockCreate,
                  },
                }) as any,
            );

            // Execute
            const provider = new OpenAiProvider();

            // Verify
            await expect(provider.operate("test input")).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });

          it("Throws BadGatewayError non-retryable PermissionDeniedError", async () => {
            // Setup
            const mockCreate = vi
              .fn()
              .mockRejectedValue(
                new PermissionDeniedError(
                  403,
                  "Permission denied error",
                  undefined,
                  {},
                ),
              );

            vi.mocked(OpenAI).mockImplementation(
              () =>
                ({
                  responses: {
                    create: mockCreate,
                  },
                }) as any,
            );

            // Execute
            const provider = new OpenAiProvider();

            // Verify
            await expect(provider.operate("test input")).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });

          it("Throws BadGatewayError non-retryable RateLimitError", async () => {
            // Setup
            const mockCreate = vi
              .fn()
              .mockRejectedValue(
                new RateLimitError(429, "Rate limit error", undefined, {}),
              );

            vi.mocked(OpenAI).mockImplementation(
              () =>
                ({
                  responses: {
                    create: mockCreate,
                  },
                }) as any,
            );

            // Execute
            const provider = new OpenAiProvider();

            // Verify
            await expect(provider.operate("test input")).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });

          it("Throws BadGatewayError non-retryable UnprocessableEntityError", async () => {
            // Setup
            const mockCreate = vi
              .fn()
              .mockRejectedValue(
                new UnprocessableEntityError(
                  422,
                  "Unprocessable entity error",
                  undefined,
                  {},
                ),
              );

            vi.mocked(OpenAI).mockImplementation(
              () =>
                ({
                  responses: {
                    create: mockCreate,
                  },
                }) as any,
            );

            // Execute
            const provider = new OpenAiProvider();

            // Verify
            await expect(provider.operate("test input")).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
        });
      });
      describe("API Retry Observability", () => {
        it("Logs debug on retry success", async () => {
          // Setup
          const mockCreate = vi.fn();
          // First call fails with a retryable error
          mockCreate.mockRejectedValueOnce(
            new InternalServerError(
              500,
              "Internal Server Error",
              undefined,
              {},
            ),
          );
          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            content: [{ text: "Success after retry" }],
          };
          mockCreate.mockResolvedValueOnce(mockResponse);

          vi.mocked(OpenAI).mockImplementation(
            () =>
              ({
                responses: {
                  create: mockCreate,
                },
              }) as any,
          );

          // Spy on sleep function to avoid waiting in tests
          const sleepSpy = vi
            .spyOn(await import("@jaypie/core"), "sleep")
            .mockResolvedValue(undefined);

          // Spy on logger
          const mockDebug = vi.fn();
          const loggerSpy = vi
            .spyOn(await import("../utils"), "getLogger")
            .mockReturnValue({
              debug: mockDebug,
              error: vi.fn(),
              warn: vi.fn(),
              var: vi.fn(),
              trace: vi.fn(),
            } as any);

          // Execute
          const provider = new OpenAiProvider();
          const result = (await provider.operate(
            "test input",
          )) as OpenAIResponse;

          // Verify
          expect(result).toBeArray();
          expect(result).toHaveLength(1);
          expect(result[0]).toEqual(mockResponse);

          // Verify debug log was called with the correct message
          expect(mockDebug).toHaveBeenCalledWith(
            "OpenAI API call succeeded after 1 retries",
          );

          // Clean up
          sleepSpy.mockRestore();
          loggerSpy.mockRestore();
        });
        it("Logs second warn on unknown errors", async () => {
          // Setup
          const mockCreate = vi.fn();
          // Create an unknown error type that's not in the retryable list
          const unknownError = new Error("Unknown error");
          mockCreate.mockRejectedValueOnce(unknownError);

          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            content: [{ text: "Success after unknown error" }],
          };
          mockCreate.mockResolvedValueOnce(mockResponse);

          vi.mocked(OpenAI).mockImplementation(
            () =>
              ({
                responses: {
                  create: mockCreate,
                },
              }) as any,
          );

          // Spy on sleep function to avoid waiting in tests
          const sleepSpy = vi
            .spyOn(await import("@jaypie/core"), "sleep")
            .mockResolvedValue(undefined);

          // Spy on logger
          const mockWarn = vi.fn();
          const mockVar = vi.fn();
          const loggerSpy = vi
            .spyOn(await import("../utils"), "getLogger")
            .mockReturnValue({
              debug: vi.fn(),
              error: vi.fn(),
              warn: mockWarn,
              var: mockVar,
              trace: vi.fn(),
            } as any);

          // Execute
          const provider = new OpenAiProvider();
          await provider.operate("test input");

          // Verify warn log was called with the correct messages
          expect(mockWarn).toHaveBeenCalledWith(
            "OpenAI API returned unknown error",
          );
          expect(mockVar).toHaveBeenCalledWith({ error: unknownError });
          expect(mockWarn).toHaveBeenCalledWith(
            expect.stringContaining("OpenAI API call failed. Retrying"),
          );

          // Clean up
          sleepSpy.mockRestore();
          loggerSpy.mockRestore();
        });

        it("Logs error on non-retryable errors", async () => {
          // Setup
          const mockCreate = vi.fn();
          const authError = new AuthenticationError(
            401,
            "Authentication error",
            undefined,
            {},
          );
          mockCreate.mockRejectedValueOnce(authError);

          vi.mocked(OpenAI).mockImplementation(
            () =>
              ({
                responses: {
                  create: mockCreate,
                },
              }) as any,
          );

          // Spy on logger
          const mockError = vi.fn();
          const mockVar = vi.fn();
          const loggerSpy = vi
            .spyOn(await import("../utils"), "getLogger")
            .mockReturnValue({
              debug: vi.fn(),
              error: mockError,
              warn: vi.fn(),
              var: mockVar,
              trace: vi.fn(),
            } as any);

          // Execute
          const provider = new OpenAiProvider();
          try {
            await provider.operate("test input");
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            // Expected to throw
          }

          // Verify error log was called with the correct message
          expect(mockError).toHaveBeenCalledWith(
            "OpenAI API call failed with non-retryable error",
          );
          expect(mockVar).toHaveBeenCalledWith({ error: authError });

          // Clean up
          loggerSpy.mockRestore();
        });

        it("Logs warn on retryable errors", async () => {
          // Setup
          const mockCreate = vi.fn();
          // First call fails with a retryable error
          const serverError = new InternalServerError(
            500,
            "Internal Server Error",
            undefined,
            {},
          );
          mockCreate.mockRejectedValueOnce(serverError);

          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            content: [{ text: "Success after retry" }],
          };
          mockCreate.mockResolvedValueOnce(mockResponse);

          vi.mocked(OpenAI).mockImplementation(
            () =>
              ({
                responses: {
                  create: mockCreate,
                },
              }) as any,
          );

          // Spy on sleep function to avoid waiting in tests
          const sleepSpy = vi
            .spyOn(await import("@jaypie/core"), "sleep")
            .mockResolvedValue(undefined);

          // Spy on logger
          const mockWarn = vi.fn();
          const loggerSpy = vi
            .spyOn(await import("../utils"), "getLogger")
            .mockReturnValue({
              debug: vi.fn(),
              error: vi.fn(),
              warn: mockWarn,
              var: vi.fn(),
              trace: vi.fn(),
            } as any);

          // Execute
          const provider = new OpenAiProvider();
          await provider.operate("test input");

          // Verify warn log was called with the correct message
          expect(mockWarn).toHaveBeenCalledWith(
            expect.stringContaining("OpenAI API call failed. Retrying"),
          );

          // Clean up
          sleepSpy.mockRestore();
          loggerSpy.mockRestore();
        });
      });
      describe("Retryable Errors", () => {
        it("Retries APIConnectionError", async () => {
          // Setup
          const mockCreate = vi.fn();
          // First call fails with a connection error
          mockCreate.mockRejectedValueOnce(
            new APIConnectionError({ message: "Connection error" }),
          );
          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            content: [{ text: "Success after connection error" }],
          };
          mockCreate.mockResolvedValueOnce(mockResponse);

          vi.mocked(OpenAI).mockImplementation(
            () =>
              ({
                responses: {
                  create: mockCreate,
                },
              }) as any,
          );

          // Spy on sleep function to avoid waiting in tests
          const sleepSpy = vi
            .spyOn(await import("@jaypie/core"), "sleep")
            .mockResolvedValue(undefined);

          // Execute
          const provider = new OpenAiProvider();
          const result = (await provider.operate(
            "test input",
          )) as OpenAIResponse;

          // Verify
          expect(result).toBeArray();
          expect(result).toHaveLength(1);
          expect(result[0]).toEqual(mockResponse);

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockCreate).toHaveBeenCalledTimes(2);

          // Clean up
          sleepSpy.mockRestore();
        });

        it("Retries APIConnectionTimeoutError", async () => {
          // Setup
          const mockCreate = vi.fn();
          // First call fails with a timeout error
          mockCreate.mockRejectedValueOnce(
            new APIConnectionTimeoutError({ message: "Connection timeout" }),
          );
          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            content: [{ text: "Success after timeout" }],
          };
          mockCreate.mockResolvedValueOnce(mockResponse);

          vi.mocked(OpenAI).mockImplementation(
            () =>
              ({
                responses: {
                  create: mockCreate,
                },
              }) as any,
          );

          // Spy on sleep function to avoid waiting in tests
          const sleepSpy = vi
            .spyOn(await import("@jaypie/core"), "sleep")
            .mockResolvedValue(undefined);

          // Execute
          const provider = new OpenAiProvider();
          const result = (await provider.operate(
            "test input",
          )) as OpenAIResponse;

          // Verify
          expect(result).toBeArray();
          expect(result).toHaveLength(1);
          expect(result[0]).toEqual(mockResponse);

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockCreate).toHaveBeenCalledTimes(2);

          // Clean up
          sleepSpy.mockRestore();
        });

        it("Retries InternalServerError", async () => {
          // Setup
          const mockCreate = vi.fn();
          // First call fails with a server error
          mockCreate.mockRejectedValueOnce(
            new InternalServerError(
              500,
              "Internal Server Error",
              undefined,
              {},
            ),
          );
          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            content: [{ text: "Success after server error" }],
          };
          mockCreate.mockResolvedValueOnce(mockResponse);

          vi.mocked(OpenAI).mockImplementation(
            () =>
              ({
                responses: {
                  create: mockCreate,
                },
              }) as any,
          );

          // Spy on sleep function to avoid waiting in tests
          const sleepSpy = vi
            .spyOn(await import("@jaypie/core"), "sleep")
            .mockResolvedValue(undefined);

          // Execute
          const provider = new OpenAiProvider();
          const result = (await provider.operate(
            "test input",
          )) as OpenAIResponse;

          // Verify
          expect(result).toBeArray();
          expect(result).toHaveLength(1);
          expect(result[0]).toEqual(mockResponse);

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockCreate).toHaveBeenCalledTimes(2);

          // Clean up
          sleepSpy.mockRestore();
        });

        it("Retries unknown errors", async () => {
          // Setup
          const mockCreate = vi.fn();
          // First call fails with an unknown error
          const unknownError = new Error("Unknown error");
          mockCreate.mockRejectedValueOnce(unknownError);
          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            content: [{ text: "Success after unknown error" }],
          };
          mockCreate.mockResolvedValueOnce(mockResponse);

          vi.mocked(OpenAI).mockImplementation(
            () =>
              ({
                responses: {
                  create: mockCreate,
                },
              }) as any,
          );

          // Spy on sleep function to avoid waiting in tests
          const sleepSpy = vi
            .spyOn(await import("@jaypie/core"), "sleep")
            .mockResolvedValue(undefined);

          // Execute
          const provider = new OpenAiProvider();
          const result = (await provider.operate(
            "test input",
          )) as OpenAIResponse;

          // Verify
          expect(result).toBeArray();
          expect(result).toHaveLength(1);
          expect(result[0]).toEqual(mockResponse);

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockCreate).toHaveBeenCalledTimes(2);

          // Clean up
          sleepSpy.mockRestore();
        });
      });
    });
    describe("Message Options", () => {
      let mockCreate: ReturnType<typeof vi.fn>;
      let provider: OpenAiProvider;

      beforeEach(() => {
        // Setup mock response and create function
        mockCreate = vi.fn().mockResolvedValue({
          id: "resp_123",
          content: [{ text: "test response" }],
        });

        // Mock OpenAI implementation
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              responses: {
                create: mockCreate,
              },
            }) as any,
        );

        // Create provider instance
        provider = new OpenAiProvider();
      });

      it.skip("includes instruction message when provided", async () => {
        const response = await provider.operate("test message", {
          instructions: "You are a test assistant",
        });

        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: "developer", content: "You are a test assistant" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
        expect(response).toBe("test response");
      });
      it.todo("Warns if system message is provided");
      it.skip("applies placeholders to system message", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.operate("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: "developer", content: "You are a test assistant" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
      });

      it.skip("applies placeholders to user message", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.operate("Hello, {{name}}", {
          data: { name: "World" },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, World" }],
          model: expect.any(String),
        });
      });

      it.skip("respects placeholders.message option", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.operate("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { message: false },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, {{name}}" }],
          model: expect.any(String),
        });
      });

      it.skip("respects placeholders.system option", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.operate("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
          placeholders: { system: false },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: "developer", content: "You are a {{role}}" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
      });
    });
    describe("Multi Turn", () => {
      it("Calls tool when tools are provided without explicitly setting turns", async () => {
        // Setup
        const mockResponse = {
          id: "resp_123",
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"name":"World"}',
              call_id: "call_123",
            },
          ],
        };
        const mockCreate = vi.fn().mockResolvedValueOnce(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              responses: {
                create: mockCreate,
              },
            }) as any,
        );
        const mockCall = vi.fn().mockResolvedValue({ result: "tool_result" });

        // Execute
        const provider = new OpenAiProvider();
        const testInput = "Test input";
        const tools: LlmTool[] = [
          {
            name: "test_tool",
            description: "Test tool",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
            type: "function",
            call: mockCall,
          },
        ];
        const result = (await provider.operate(testInput, {
          tools,
        })) as OpenAIResponse;

        // Verify
        expect(result).toBeArray();
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(mockResponse);

        // Verify the create function was called with the right parameters
        expect(mockCreate).toHaveBeenCalledWith({
          model: expect.any(String),
          input: testInput,
          tools: expect.any(Array),
        });

        // Verify the tool was called
        expect(mockCall).toHaveBeenCalledWith({ name: "World" });
      });

      it("Continues turns until it reaches the max turns limit", async () => {
        // Setup - Create mock responses for each turn
        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"turn":1}',
              call_id: "call_1",
            },
          ],
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"turn":2}',
              call_id: "call_2",
            },
          ],
        };

        const mockResponse3 = {
          id: "resp_789",
          output: [
            {
              type: "text",
              text: "All done after 3 turns",
            },
          ],
        };

        // Create a mock for the OpenAI API call that returns different responses for each turn
        const mockCreate = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2)
          .mockResolvedValueOnce(mockResponse3);

        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              responses: {
                create: mockCreate,
              },
            }) as any,
        );

        // Mock the tool call function
        const mockCall = vi
          .fn()
          .mockResolvedValueOnce({ result: "result from turn 1" })
          .mockResolvedValueOnce({ result: "result from turn 2" });

        // Execute
        const provider = new OpenAiProvider();
        const testInput = "Test input with multiple turns";
        const tools: LlmTool[] = [
          {
            name: "test_tool",
            description: "Test tool for multiple turns",
            parameters: {
              type: "object",
              properties: {
                turn: { type: "number" },
              },
            },
            type: "function",
            call: mockCall,
          },
        ];

        const result = (await provider.operate(testInput, {
          tools,
          turns: 3, // Set maximum turns to 3
        })) as OpenAIResponse;

        // Verify
        expect(result).toBeArray();
        expect(result).toHaveLength(3); // Should have 3 responses (one for each turn)
        expect(result[0]).toEqual(mockResponse1);
        expect(result[1]).toEqual(mockResponse2);
        expect(result[2]).toEqual(mockResponse3);

        // Verify the create function was called 3 times (once for each turn)
        expect(mockCreate).toHaveBeenCalledTimes(3);

        // First call should be with the initial input
        expect(mockCreate.mock.calls[0][0]).toEqual({
          model: expect.any(String),
          input: testInput,
          tools: expect.any(Array),
        });

        // Second call should include the first function call and its result
        expect(mockCreate.mock.calls[1][0].input).toBeArray();
        expect(mockCreate.mock.calls[1][0].input).toContainEqual({
          type: "function_call",
          name: "test_tool",
          arguments: '{"turn":1}',
          call_id: "call_1",
        });
        expect(mockCreate.mock.calls[1][0].input).toContainEqual({
          type: "function_call_output",
          call_id: "call_1",
          output: JSON.stringify({ result: "result from turn 1" }),
        });

        // Third call should include the second function call and its result
        expect(mockCreate.mock.calls[2][0].input).toBeArray();
        expect(mockCreate.mock.calls[2][0].input).toContainEqual({
          type: "function_call",
          name: "test_tool",
          arguments: '{"turn":2}',
          call_id: "call_2",
        });
        expect(mockCreate.mock.calls[2][0].input).toContainEqual({
          type: "function_call_output",
          call_id: "call_2",
          output: JSON.stringify({ result: "result from turn 2" }),
        });

        // Verify the tool was called twice (once for each function call)
        expect(mockCall).toHaveBeenCalledTimes(2);
        expect(mockCall).toHaveBeenNthCalledWith(1, { turn: 1 });
        expect(mockCall).toHaveBeenNthCalledWith(2, { turn: 2 });
      });

      it("Runs to default max turns (12) when no max is specified", async () => {
        // Import the constant for default max turns
        const { MAX_TURNS_DEFAULT_LIMIT } = await import("../operate");

        // Setup - Create mock responses for each turn
        const mockResponses = [];
        const mockCreate = vi.fn();

        // Create 12 mock responses, each with a function call
        for (let i = 1; i <= MAX_TURNS_DEFAULT_LIMIT; i++) {
          const mockResponse = {
            id: `resp_${i}`,
            output: [
              {
                type: "function_call",
                name: "test_tool",
                arguments: `{"turn":${i}}`,
                call_id: `call_${i}`,
              },
            ],
          };
          mockResponses.push(mockResponse);

          // For the last response, we'll have it return a text response
          // to show that we're stopping because of max turns, not because
          // there are no more function calls
          if (i === MAX_TURNS_DEFAULT_LIMIT) {
            mockCreate.mockResolvedValueOnce(mockResponse);
          } else {
            mockCreate.mockResolvedValueOnce(mockResponse);
          }
        }

        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              responses: {
                create: mockCreate,
              },
            }) as any,
        );

        // Mock the tool call function to return a result for each turn
        const mockCall = vi.fn();
        for (let i = 1; i <= MAX_TURNS_DEFAULT_LIMIT; i++) {
          mockCall.mockResolvedValueOnce({ result: `result from turn ${i}` });
        }

        // Execute
        const provider = new OpenAiProvider();
        const testInput = "Test input with default max turns";
        const tools: LlmTool[] = [
          {
            name: "test_tool",
            description: "Test tool for default max turns",
            parameters: {
              type: "object",
              properties: {
                turn: { type: "number" },
              },
            },
            type: "function",
            call: mockCall,
          },
        ];

        // Call operate with tools but no explicit turns parameter
        // This should use the default max turns (12)
        const result = (await provider.operate(testInput, {
          tools,
          // No turns parameter specified
        })) as OpenAIResponse;

        // Verify
        expect(result).toBeArray();
        expect(result).toHaveLength(MAX_TURNS_DEFAULT_LIMIT);

        // Verify all responses are in the result
        for (let i = 0; i < MAX_TURNS_DEFAULT_LIMIT; i++) {
          expect(result[i]).toEqual(mockResponses[i]);
        }

        // Verify the create function was called MAX_TURNS_DEFAULT_LIMIT times
        expect(mockCreate).toHaveBeenCalledTimes(MAX_TURNS_DEFAULT_LIMIT);

        // Verify the first call was with the initial input
        expect(mockCreate.mock.calls[0][0]).toEqual({
          model: expect.any(String),
          input: testInput,
          tools: expect.any(Array),
        });

        // Verify each subsequent call included the previous function call and result
        for (let i = 1; i < MAX_TURNS_DEFAULT_LIMIT; i++) {
          expect(mockCreate.mock.calls[i][0].input).toBeArray();

          // Should contain the function call from the previous turn
          expect(mockCreate.mock.calls[i][0].input).toContainEqual({
            type: "function_call",
            name: "test_tool",
            arguments: `{"turn":${i}}`,
            call_id: `call_${i}`,
          });

          // Should contain the function call result from the previous turn
          expect(mockCreate.mock.calls[i][0].input).toContainEqual({
            type: "function_call_output",
            call_id: `call_${i}`,
            output: JSON.stringify({ result: `result from turn ${i}` }),
          });
        }

        // Verify the tool was called MAX_TURNS_DEFAULT_LIMIT times
        expect(mockCall).toHaveBeenCalledTimes(MAX_TURNS_DEFAULT_LIMIT);

        // Verify each call to the tool had the correct arguments
        for (let i = 1; i <= MAX_TURNS_DEFAULT_LIMIT; i++) {
          expect(mockCall).toHaveBeenNthCalledWith(i, { turn: i });
        }
      });

      it("Properly resolves Promise results from toolkit calls", async () => {
        // Setup - Create a mock response with a function call
        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: "function_call",
              name: "async_tool",
              arguments: '{"delay":100}',
              call_id: "call_1",
            },
          ],
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: "text",
              text: "Completed async operation",
            },
          ],
        };

        // Create a mock for the OpenAI API call
        const mockCreate = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              responses: {
                create: mockCreate,
              },
            }) as any,
        );

        // Create a Promise that will be returned by the tool
        const asyncResult = {
          status: "completed",
          data: "async operation result",
        };

        // Mock the tool call function to return a Promise
        // This tests our new code that handles Promise results
        const mockAsyncCall = vi.fn().mockImplementation(({ delay }) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(asyncResult);
            }, delay);
          });
        });

        // Execute
        const provider = new OpenAiProvider();
        const testInput = "Test input with async tool";
        const tools: LlmTool[] = [
          {
            name: "async_tool",
            description: "Test tool that returns a Promise",
            parameters: {
              type: "object",
              properties: {
                delay: { type: "number" },
              },
            },
            type: "function",
            call: mockAsyncCall,
          },
        ];

        const result = (await provider.operate(testInput, {
          tools,
          turns: true, // Enable multi-turn
        })) as OpenAIResponse;

        // Verify
        expect(result).toBeArray();
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(mockResponse1);
        expect(result[1]).toEqual(mockResponse2);

        // Verify the create function was called twice
        expect(mockCreate).toHaveBeenCalledTimes(2);

        // First call should be with the initial input
        expect(mockCreate.mock.calls[0][0]).toEqual({
          model: expect.any(String),
          input: testInput,
          tools: expect.any(Array),
        });

        // Second call should include the function call and its resolved Promise result
        expect(mockCreate.mock.calls[1][0].input).toBeArray();
        expect(mockCreate.mock.calls[1][0].input).toContainEqual({
          type: "function_call",
          name: "async_tool",
          arguments: '{"delay":100}',
          call_id: "call_1",
        });
        expect(mockCreate.mock.calls[1][0].input).toContainEqual({
          type: "function_call_output",
          call_id: "call_1",
          output: JSON.stringify(asyncResult),
        });

        // Verify the async tool was called with the correct arguments
        expect(mockAsyncCall).toHaveBeenCalledTimes(1);
        expect(mockAsyncCall).toHaveBeenCalledWith({ delay: 100 });
      });
    });
    describe("Structured Output", () => {
      it.skip("Uses beta endpoint when structured output is requested", async () => {
        const mockParsedResponse = {
          salutation: "Hello",
          name: "World",
        };

        const mockResponse = {
          choices: [
            {
              message: {
                parsed: mockParsedResponse,
              },
            },
          ],
        };

        const mockParse = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              beta: {
                chat: {
                  completions: {
                    parse: mockParse,
                  },
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });
        const response = await provider.operate("Hello, World", {
          response: GreetingFormat,
        });

        expect(response).toEqual(mockParsedResponse);
        expect(mockParse).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, World" }],
          model: expect.any(String),
          response_format: expect.any(Object),
        });
      });

      it.skip("Handles NaturalSchema response format", async () => {
        const mockParsedResponse = {
          salutation: "Hello",
          name: "World",
        };

        const mockResponse = {
          choices: [
            {
              message: {
                parsed: mockParsedResponse,
              },
            },
          ],
        };

        const mockParse = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              beta: {
                chat: {
                  completions: {
                    parse: mockParse,
                  },
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const GreetingFormat = {
          salutation: String,
          name: String,
        };
        const response = await provider.operate("Hello, World", {
          response: GreetingFormat,
        });

        expect(response).toEqual(mockParsedResponse);
        expect(mockParse).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, World" }],
          model: expect.any(String),
          response_format: expect.any(Object),
        });
      });
    });
  });
});

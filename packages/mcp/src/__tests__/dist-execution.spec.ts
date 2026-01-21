import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_INDEX_PATH = path.join(__dirname, "..", "..", "dist", "index.js");

/**
 * Helper function to execute the dist/index.js file with JSON-RPC input
 * and capture the output
 */
function executeDistWithInput(input: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  return new Promise((resolve) => {
    const child = spawn("node", [DIST_INDEX_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let hasOutput = false;
    let outputTimer: ReturnType<typeof setTimeout> | null = null;

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      hasOutput = true;

      if (outputTimer) {
        clearTimeout(outputTimer);
      }
      outputTimer = setTimeout(() => {
        child.kill();
      }, 500);
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (outputTimer) {
        clearTimeout(outputTimer);
      }
      resolve({
        stdout,
        stderr,
        exitCode: code,
      });
    });

    child.stdin.write(input + "\n");
    child.stdin.end();

    // Use longer timeout for CI environments (especially Node 22.x)
    const FALLBACK_TIMEOUT = process.env.CI ? 10000 : 3000;
    setTimeout(() => {
      if (outputTimer) {
        clearTimeout(outputTimer);
      }
      child.kill();
      if (!hasOutput) {
        resolve({
          stdout,
          stderr,
          exitCode: null,
        });
      }
    }, FALLBACK_TIMEOUT);
  });
}

describe("Dist Execution", () => {
  describe("Base Cases", () => {
    it("dist/index.js file exists", async () => {
      const fs = await import("node:fs/promises");
      await expect(fs.access(DIST_INDEX_PATH)).resolves.not.toThrow();
    });
  });

  describe("Happy Paths", () => {
    it("responds to tools/list JSON-RPC command", async () => {
      const input = JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      });

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let toolsListResponse = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 1 && parsed.result?.tools) {
            toolsListResponse = parsed;
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(toolsListResponse).toBeTruthy();
      expect(toolsListResponse?.result).toHaveProperty("tools");
      expect(Array.isArray(toolsListResponse?.result.tools)).toBe(true);

      const tools = toolsListResponse?.result.tools || [];
      const toolNames = tools.map((tool: { name: string }) => tool.name);
      expect(toolNames).toContain("list_prompts");
      expect(toolNames).toContain("read_prompt");
    });

    it("responds to initialize JSON-RPC command", async () => {
      const input = JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
        id: 1,
      });

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let initializeResponse = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 1 && parsed.result) {
            initializeResponse = parsed;
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(initializeResponse).toBeTruthy();
      expect(initializeResponse?.result).toHaveProperty("protocolVersion");
      expect(initializeResponse?.result).toHaveProperty("serverInfo");
      expect(initializeResponse?.result.serverInfo).toHaveProperty("name");
      expect(initializeResponse?.result.serverInfo.name).toBe("jaypie");
    });
  });

  describe("Features", () => {
    it("handles multiple sequential JSON-RPC commands", async () => {
      const input =
        JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        }) +
        "\n" +
        JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 2,
        });

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      const responses = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id) {
            responses.push(parsed);
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(responses.length).toBeGreaterThanOrEqual(2);

      const initResponse = responses.find((r) => r.id === 1);
      const toolsResponse = responses.find((r) => r.id === 2);

      expect(initResponse).toBeTruthy();
      expect(initResponse?.result).toHaveProperty("serverInfo");

      expect(toolsResponse).toBeTruthy();
      expect(toolsResponse?.result).toHaveProperty("tools");
    });

    it("handles tool call for list_prompts", async () => {
      const input =
        JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        }) +
        "\n" +
        JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "list_prompts",
            arguments: {},
          },
          id: 2,
        });

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let toolCallResponse = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 2 && parsed.result) {
            toolCallResponse = parsed;
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(toolCallResponse).toBeTruthy();
      expect(toolCallResponse?.result).toHaveProperty("content");
      expect(Array.isArray(toolCallResponse?.result.content)).toBe(true);
    });
  });

  describe("Specific Scenarios", () => {
    it("simulates the exact command: echo '{...}' | npx -y @jaypie/mcp", async () => {
      const input = '{"jsonrpc":"2.0","method":"tools/list","id":1}';

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let foundTools = false;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result?.tools) {
            foundTools = true;
            const toolNames = parsed.result.tools.map(
              (tool: { name: string }) => tool.name,
            );
            expect(toolNames).toContain("list_prompts");
            expect(toolNames).toContain("read_prompt");
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(foundTools).toBe(true);
    });
  });

  describe("Skill Tool", () => {
    it("includes skill tool in tools/list response", async () => {
      const input = JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      });

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let toolsListResponse = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 1 && parsed.result?.tools) {
            toolsListResponse = parsed;
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(toolsListResponse).toBeTruthy();
      const toolNames = toolsListResponse?.result.tools.map(
        (tool: { name: string }) => tool.name,
      );
      expect(toolNames).toContain("skill");
    });

    it("handles skill('index') call to list all skills", async () => {
      const input =
        JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        }) +
        "\n" +
        JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "skill",
            arguments: { alias: "index" },
          },
          id: 2,
        });

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let toolCallResponse = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 2 && parsed.result) {
            toolCallResponse = parsed;
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(toolCallResponse).toBeTruthy();
      expect(toolCallResponse?.result).toHaveProperty("content");
      expect(Array.isArray(toolCallResponse?.result.content)).toBe(true);

      // Content should list available skills
      const textContent = toolCallResponse?.result.content.find(
        (c: { type: string }) => c.type === "text",
      );
      expect(textContent).toBeTruthy();
      expect(textContent?.text).toContain("Available Skills");
      expect(textContent?.text).toContain("aws");
      expect(textContent?.text).toContain("tests");
    });

    it("handles skill('aws') call to get specific skill content", async () => {
      const input =
        JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        }) +
        "\n" +
        JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "skill",
            arguments: { alias: "aws" },
          },
          id: 2,
        });

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let toolCallResponse = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 2 && parsed.result) {
            toolCallResponse = parsed;
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(toolCallResponse).toBeTruthy();
      expect(toolCallResponse?.result).toHaveProperty("content");

      const textContent = toolCallResponse?.result.content.find(
        (c: { type: string }) => c.type === "text",
      );
      expect(textContent).toBeTruthy();
      // AWS skill should contain AWS-related content
      expect(textContent?.text).toContain("AWS");
    });

    it("rejects path traversal attempts in skill alias", async () => {
      const input =
        JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        }) +
        "\n" +
        JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "skill",
            arguments: { alias: "../../../etc/passwd" },
          },
          id: 2,
        });

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let toolCallResponse = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 2) {
            toolCallResponse = parsed;
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(toolCallResponse).toBeTruthy();
      // Should return an error message for invalid alias
      const textContent = toolCallResponse?.result?.content?.find(
        (c: { type: string }) => c.type === "text",
      );
      expect(textContent?.text).toContain("Invalid skill alias");
    });

    it("returns error for non-existent skill", async () => {
      const input =
        JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 1,
        }) +
        "\n" +
        JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "skill",
            arguments: { alias: "nonexistent-skill-xyz" },
          },
          id: 2,
        });

      const result = await executeDistWithInput(input);

      expect(result.stdout).toBeTruthy();

      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      let toolCallResponse = null;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === 2) {
            toolCallResponse = parsed;
            break;
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      expect(toolCallResponse).toBeTruthy();
      // Should return an error message for non-existent skill
      const textContent = toolCallResponse?.result?.content?.find(
        (c: { type: string }) => c.type === "text",
      );
      expect(textContent?.text).toContain("not found");
    });
  });
});

import type { Application, RequestHandler } from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { log } from "@jaypie/logger";

import cors from "./cors.helper.js";
import type { CorsConfig } from "./cors.helper.js";

//
//
// Constants
//

const DEFAULT_PORT = 8080;

//
//
// Types
//

export interface CreateServerOptions {
  /**
   * CORS configuration. Pass false to disable CORS middleware.
   */
  cors?: CorsConfig | false;
  /**
   * JSON body parser limit. Defaults to "1mb".
   */
  jsonLimit?: string;
  /**
   * Additional middleware to apply before routes.
   */
  middleware?: RequestHandler[];
  /**
   * Port to listen on. Defaults to PORT env var or 8080.
   */
  port?: number | string;
}

export interface ServerResult {
  /**
   * The HTTP server instance.
   */
  server: Server;
  /**
   * The port the server is listening on.
   */
  port: number;
}

//
//
// Main
//

/**
 * Creates and starts an Express server with standard Jaypie middleware.
 *
 * Features:
 * - CORS handling (configurable)
 * - JSON body parsing
 * - Listens on PORT env var (default 8080)
 *
 * Usage:
 * ```ts
 * import express from "express";
 * import { createServer, expressHandler } from "@jaypie/express";
 *
 * const app = express();
 *
 * app.get("/", expressHandler(async (req, res) => {
 *   return { message: "Hello World" };
 * }));
 *
 * const { server, port } = await createServer(app);
 * console.log(`Server running on port ${port}`);
 * ```
 *
 * @param app - Express application instance
 * @param options - Server configuration options
 * @returns Promise resolving to server instance and port
 */
async function createServer(
  app: Application,
  options: CreateServerOptions = {},
): Promise<ServerResult> {
  const {
    cors: corsConfig,
    jsonLimit = "1mb",
    middleware = [],
    port: portOption,
  } = options;

  // Determine port
  const port =
    typeof portOption === "string"
      ? parseInt(portOption, 10)
      : (portOption ?? parseInt(process.env.PORT || String(DEFAULT_PORT), 10));

  // Apply CORS middleware (unless explicitly disabled)
  if (corsConfig !== false) {
    app.use(cors(corsConfig));
  }

  // Apply JSON body parser
  // Note: We use dynamic import to avoid requiring express as a direct dependency
  const express = await import("express");
  app.use(express.json({ limit: jsonLimit }));

  // Apply additional middleware
  for (const mw of middleware) {
    app.use(mw);
  }

  // Start server
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(port, () => {
        // Get the actual port (important when port 0 is passed to get an ephemeral port)
        const address = server.address() as AddressInfo;
        const actualPort = address?.port ?? port;
        log.info(`Server listening on port ${actualPort}`);
        resolve({ port: actualPort, server });
      });

      server.on("error", (error) => {
        log.error("Server error", { error });
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

//
//
// Export
//

export default createServer;

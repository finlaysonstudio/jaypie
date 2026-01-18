import express from "express";
import { createLambdaHandler, expressHandler } from "./dist/esm/index.js";

const app = express();
app.use(express.json());

// Health check - 204 No Content (wrapped with expressHandler)
app.get(
  "/",
  expressHandler(() => {
    // Return nothing for 204
  }),
);

// Echo endpoint for debugging (wrapped with expressHandler)
app.all(
  "/_sys/echo",
  expressHandler((req) => {
    return {
      body: req.body,
      headers: req.headers,
      method: req.method,
      path: req.path,
      query: req.query,
    };
  }),
);

// Streaming endpoint using res.write() and res.end()
// In buffered mode (Docker/RIE): chunks are collected and returned as one response
// In streaming mode (Lambda Web Adapter): chunks are streamed in real-time
app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Parse seconds from query param (default 6, max 30)
  const seconds = Math.min(parseInt(req.query.seconds) || 6, 30);
  let count = 0;

  const interval = setInterval(() => {
    count++;
    res.write(`data: noop ${count}/${seconds}\n\n`);

    if (count >= seconds) {
      clearInterval(interval);
      res.write(`data: Done! Final message after ${seconds} seconds.\n\n`);
      res.end();
    }
  }, 1000);
});

// 404 for everything else (plain Express for comparison)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
  });
});

export const handler = createLambdaHandler(app);

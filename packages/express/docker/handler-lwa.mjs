/**
 * Lambda Web Adapter (LWA) Streaming Example
 *
 * This handler runs Express as a real HTTP server on port 8000.
 * When deployed with JaypieStreamingLambda, the Lambda Web Adapter
 * layer handles the Lambda integration and enables real-time streaming.
 *
 * Local Testing:
 *   node docker/handler-lwa.mjs
 *   curl -N http://localhost:8000/stream
 *
 * AWS Deployment:
 *   Use JaypieStreamingLambda with streaming: true
 *   The Lambda Web Adapter layer handles Lambda <-> HTTP translation
 *
 * @see packages/constructs/src/JaypieStreamingLambda.ts
 */
import express from "express";

const PORT = process.env.PORT || 8000;

const app = express();
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.status(204).end();
});

// Streaming endpoint - sends data over 6 seconds
// With LWA + RESPONSE_STREAM, this streams in real-time
app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Flush headers immediately (important for streaming)
  res.flushHeaders();

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

  // Handle client disconnect
  req.on("close", () => {
    clearInterval(interval);
  });
});

// Echo endpoint for debugging
app.all("/_sys/echo", (req, res) => {
  res.json({
    body: req.body,
    headers: req.headers,
    method: req.method,
    path: req.path,
    query: req.query,
  });
});

// 404 for everything else
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
  });
});

// Start server (Lambda Web Adapter connects to this port)
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Test streaming: curl -N http://localhost:${PORT}/stream`);
});

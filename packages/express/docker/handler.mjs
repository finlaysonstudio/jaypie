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

// 404 for everything else (plain Express for comparison)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
  });
});

export const handler = createLambdaHandler(app);

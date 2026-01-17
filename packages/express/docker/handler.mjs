import express from "express";
import { createLambdaHandler } from "./dist/esm/index.js";

const app = express();
app.use(express.json());

// Health check - 204 No Content
app.get("/", (req, res) => res.status(204).send());

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

export const handler = createLambdaHandler(app);

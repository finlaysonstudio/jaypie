import express from "express";
import { createLambdaHandler } from "./dist/esm/index.js";

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.json({ message: "Hello from Lambda!" }));
app.get("/echo", (req, res) => res.json({ query: req.query }));
app.post("/echo", (req, res) => res.json({ body: req.body }));
app.get("/headers", (req, res) => res.json({ headers: req.headers }));
app.get("/error", (req, res) => {
  throw new Error("Test error");
});

export const handler = createLambdaHandler(app);

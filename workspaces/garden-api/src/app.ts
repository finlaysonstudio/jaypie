import {
  cors,
  echoRoute,
  EXPRESS,
  noContentRoute,
  notFoundRoute,
} from "jaypie";
import express from "express";

import keyTestRoute from "./routes/keyTest.route.js";

const app = express();

// Built-in Jaypie routes
app.get(EXPRESS.PATH.ROOT, noContentRoute);
app.use("/_sy/echo", cors(), echoRoute);

// API routes
app.post("/api/key/test", cors(), keyTestRoute);

// Catch-all
app.all(EXPRESS.PATH.ANY, notFoundRoute);

export default app;

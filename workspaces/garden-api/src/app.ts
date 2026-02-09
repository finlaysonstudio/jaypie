import {
  cors,
  echoRoute,
  EXPRESS,
  noContentRoute,
  notFoundRoute,
} from "jaypie";
import express from "express";

const app = express();

// Built-in Jaypie routes
app.get(EXPRESS.PATH.ROOT, noContentRoute);
app.use("/_sy/echo", cors(), echoRoute);

// Catch-all
app.all(EXPRESS.PATH.ANY, notFoundRoute);

export default app;

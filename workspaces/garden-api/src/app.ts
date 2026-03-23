import {
  cors,
  echoRoute,
  EXPRESS,
  noContentRoute,
  notFoundRoute,
} from "jaypie";
import express from "express";

import apikeyValidateRoute from "./routes/apikeyValidate.route.js";

const app = express();

// Built-in Jaypie routes
app.get(EXPRESS.PATH.ROOT, noContentRoute);
app.use("/_sy/echo", cors(), echoRoute);

// API routes
app.post("/apikey/validate", cors(), apikeyValidateRoute);

// Catch-all
app.all(EXPRESS.PATH.ANY, notFoundRoute);

export default app;

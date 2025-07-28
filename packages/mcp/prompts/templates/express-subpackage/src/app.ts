import { cors, echoRoute, EXPRESS, noContentRoute, notFoundRoute } from "jaypie";
import express from "express";
import resourceRouter from "./routes/resource.router.js";

const app = express();

// Built-in Jaypie routes
app.get(EXPRESS.PATH.ROOT, noContentRoute);
app.use("/_sy/echo", cors(), echoRoute);

// Application routes
app.use(/^\/resource$/, cors(), resourceRouter);
app.use("/resource/", cors(), resourceRouter);

// Catch-all
app.all(EXPRESS.PATH.ANY, notFoundRoute);

export default app;
import serverlessExpress from "@codegenie/serverless-express";
import app from "./src/app.js";

export default serverlessExpress({ app });

if (process.env.NODE_ENV === "development") {
  app.listen(8080);
}
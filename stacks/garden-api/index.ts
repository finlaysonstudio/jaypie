import { createLambdaStreamHandler } from "jaypie";

import app from "./src/app.js";

// Lambda handler for Function URL with streaming
export const handler = createLambdaStreamHandler(app);

if (process.env.NODE_ENV === "development") {
  app.listen(8080);
}

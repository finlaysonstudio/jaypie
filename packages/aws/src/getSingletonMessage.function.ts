import { BadGatewayError } from "@jaypie/errors";
import getMessages from "./getMessages.function.js";

//
//
// Main
//

const getSingletonMessage = (event: unknown): unknown => {
  const messages = getMessages(event);

  if (messages.length !== 1) {
    throw new BadGatewayError(
      "An upstream resource provided an invalid message format",
    );
  }

  return messages[0];
};

//
//
// Export
//

export default getSingletonMessage;

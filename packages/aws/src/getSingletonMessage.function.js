import { BadGatewayError } from "jaypie";
import getMessages from "./getMessages.function";

//
//
// Main
//

const getSingletonMessage = async (event) => {
  const messages = getMessages(event);

  if (messages.length === 0) {
    return null;
  }

  if (messages.length > 1) {
    throw new BadGatewayError("An upstream resource provided an invalid message format");
  }

  return messages[0];
};

//
//
// Export
//

export default getSingletonMessage;
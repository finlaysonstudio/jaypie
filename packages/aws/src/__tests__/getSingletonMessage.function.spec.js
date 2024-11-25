import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import getSingletonMessage from "../getSingletonMessage.function.js";
import getMessages from "../getMessages.function.js";

//
//
// Mock modules
//

vi.mock("../getMessages.function.js");

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("GetSingletonMessage Function", () => {
  it("returns the single message when exactly one message exists", () => {
    const mockMessage = { id: 1, content: "test message" };
    getMessages.mockReturnValue([mockMessage]);

    const response = getSingletonMessage({});
    expect(response).toEqual(mockMessage);
  });

  it("throws BadGatewayError when multiple messages are found", () => {
    const mockMessages = [
      { id: 1, content: "message 1" },
      { id: 2, content: "message 2" },
    ];
    getMessages.mockReturnValue(mockMessages);

    expect(getSingletonMessage).toThrowBadGatewayError();
  });

  it("throws BadGatewayError when no messages are found", () => {
    getMessages.mockReturnValue([]);

    expect(getSingletonMessage).toThrowBadGatewayError();
  });

  it("passes the event object to getMessages", () => {
    const mockEvent = { Records: [{}] };
    getMessages.mockReturnValue([{}]);

    getSingletonMessage(mockEvent);
    expect(getMessages).toHaveBeenCalledWith(mockEvent);
  });
});

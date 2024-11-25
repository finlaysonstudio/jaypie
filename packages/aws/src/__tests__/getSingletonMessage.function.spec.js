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
  it("returns null when no messages are found", async () => {
    getMessages.mockReturnValue([]);
    const response = await getSingletonMessage({});
    expect(response).toBeNull();
  });

  it("returns the single message when exactly one message exists", async () => {
    const mockMessage = { id: 1, content: "test message" };
    getMessages.mockReturnValue([mockMessage]);

    const response = await getSingletonMessage({});
    expect(response).toEqual(mockMessage);
  });

  it("throws BadGatewayError when multiple messages are found", async () => {
    const mockMessages = [
      { id: 1, content: "message 1" },
      { id: 2, content: "message 2" },
    ];
    getMessages.mockReturnValue(mockMessages);

    await expect(getSingletonMessage).toThrowBadGatewayError();
  });

  it("passes the event object to getMessages", async () => {
    const mockEvent = { Records: [] };
    getMessages.mockReturnValue([]);

    await getSingletonMessage(mockEvent);
    expect(getMessages).toHaveBeenCalledWith(mockEvent);
  });
});

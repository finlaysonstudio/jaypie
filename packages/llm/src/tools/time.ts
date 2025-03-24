import { LlmTool } from "../types/LlmTool.interface.js";

export const time: LlmTool = {
  description:
    "Returns the provided date as an ISO UTC string or the current time if no date provided.",
  name: "time",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description:
          "Date string to convert to ISO UTC format. Default: current time",
      },
    },
    required: [],
  },
  type: "function",
  call: ({ date } = {}) => {
    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        throw new Error(`Invalid date format: ${date}`);
      }
      return parsedDate.toISOString();
    }
    return new Date().toISOString();
  },
};

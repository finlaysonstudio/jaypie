import { expressHandler } from "jaypie";
import type { Request } from "express";
import handlerConfig from "../../handler.config.js";

interface ResourceGetResponse {
  message: string;
  query: Record<string, any>;
  timestamp: string;
}

export default expressHandler(
  handlerConfig("resourceGet"),
  async (req: Request): Promise<ResourceGetResponse> => {
    const { query } = req;
    
    return {
      message: "Resource endpoint",
      query,
      timestamp: new Date().toISOString(),
    };
  }
);
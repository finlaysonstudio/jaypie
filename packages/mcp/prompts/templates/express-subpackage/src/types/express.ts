declare global {
  namespace Express {
    interface Request {
      locals?: Record<string, any>;
    }
  }
}

export {};
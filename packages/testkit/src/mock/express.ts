import { createMockFunction, createDeepMock } from "./utils";

export const mockRequest = (overrides = {}) =>
  createDeepMock(
    {
      params: {},
      query: {},
      body: {},
      headers: {},
      cookies: {},
      session: {},
      path: "/mock-path",
      method: "GET",
    },
    overrides,
  );

export const mockResponse = () => {
  const res: any = {};
  res.status = createMockFunction(() => res);
  res.json = createMockFunction(() => res);
  res.send = createMockFunction(() => res);
  res.end = createMockFunction(() => res);
  res.setHeader = createMockFunction(() => res);
  res.redirect = createMockFunction(() => res);
  res.render = createMockFunction(() => res);
  return res;
};

export const mockNext = createMockFunction<() => void>();

export const mockRouter = () => ({
  get: createMockFunction(),
  post: createMockFunction(),
  put: createMockFunction(),
  delete: createMockFunction(),
  patch: createMockFunction(),
  use: createMockFunction(),
});

interface Pipeline {
  key: string;
  filter: (value: unknown) => unknown;
}

function isAxiosResponse(response: unknown): boolean {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  const r = response as Record<string, unknown>;
  return !!(
    r &&
    r.config &&
    r.data &&
    r.headers &&
    r.request &&
    r.status &&
    r.statusText
  );
}

function filterAxiosResponse(response: unknown): unknown {
  if (!isAxiosResponse(response)) {
    return response;
  }
  const r = response as Record<string, unknown>;
  const newResponse: Record<string, unknown> = {
    data: r.data,
    headers: r.headers,
    status: r.status,
    statusText: r.statusText,
  };
  if (r.isAxiosError) {
    newResponse.isAxiosError = r.isAxiosError;
  }
  return newResponse;
}

export const axiosResponseVarPipeline: Pipeline = {
  filter: filterAxiosResponse,
  key: "response",
};

function isError(item: unknown): boolean {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  if (item instanceof Error) {
    return true;
  }
  const i = item as Record<string, unknown>;
  if (i.isProjectError) {
    return true;
  }
  return false;
}

function filterErrorVar(item: unknown): unknown {
  if (!isError(item)) {
    return item;
  }
  const e = item as Error & Record<string, unknown>;
  const newItem: Record<string, unknown> = {
    message: e.message,
    name: e.name,
  };
  if (e.cause) {
    newItem.cause = e.cause;
  }
  if (e.stack) {
    newItem.stack = e.stack;
  }
  if (e.isProjectError) {
    newItem.isProjectError = e.isProjectError;
    newItem.title = e.title;
    newItem.detail = e.detail;
    newItem.status = e.status;
  }
  return newItem;
}

export const errorVarPipeline: Pipeline = {
  filter: filterErrorVar,
  key: "error",
};

export const pipelines = [axiosResponseVarPipeline, errorVarPipeline];

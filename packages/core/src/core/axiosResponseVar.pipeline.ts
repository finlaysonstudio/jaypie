//
//
// Types
//

interface AxiosResponse {
  config: unknown;
  data: unknown;
  headers: unknown;
  request: unknown;
  status: number;
  statusText: string;
  isAxiosError?: boolean;
}

interface FilteredAxiosResponse {
  status: number;
  statusText: string;
  headers: unknown;
  data: unknown;
  isAxiosError?: boolean;
}

//
//
// Helper Functions
//

function isAxiosResponse(response: unknown): response is AxiosResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  const resp = response as Record<string, unknown>;
  return (
    resp &&
    resp.config !== undefined &&
    resp.data !== undefined &&
    resp.headers !== undefined &&
    resp.request !== undefined &&
    resp.status !== undefined &&
    resp.statusText !== undefined
  );
}

function filterAxiosResponse(
  response: unknown,
): FilteredAxiosResponse | unknown {
  if (!isAxiosResponse(response)) {
    return response;
  }
  const newResponse: FilteredAxiosResponse = {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data,
  };
  if (response.isAxiosError) {
    newResponse.isAxiosError = response.isAxiosError;
  }
  return newResponse;
}

//
//
// Export
//

export default {
  key: "response",
  filter: filterAxiosResponse,
};

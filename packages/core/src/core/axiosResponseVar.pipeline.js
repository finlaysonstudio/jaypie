//
//
// Helper Functions
//

function isAxiosResponse(response) {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  return (
    response &&
    response.config &&
    response.data &&
    response.headers &&
    response.request &&
    response.status &&
    response.statusText
  );
}

function filterAxiosResponse(response) {
  if (!isAxiosResponse(response)) {
    return response;
  }
  const newResponse = {
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

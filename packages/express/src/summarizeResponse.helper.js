//
//
// Function Definition
//

function summarizeResponse(res, extras) {
  const response = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
  };
  if (typeof res.getHeaders === "function") {
    response.headers = res.getHeaders();
  }
  if (typeof extras === "object" && extras !== null) {
    Object.assign(response, extras);
  }
  return response;
}

//
//
// Export
//

export default summarizeResponse;

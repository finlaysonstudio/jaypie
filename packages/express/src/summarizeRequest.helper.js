//
//
// Function Definition
//

function summarizeRequest(req) {
  // If body is a buffer, convert it to a string
  let { body } = req;
  if (Buffer.isBuffer(body)) {
    body = body.toString();
  }

  return {
    baseUrl: req.baseUrl,
    body,
    headers: req.headers,
    method: req.method,
    query: req.query,
    url: req.url,
  };
}

//
//
// Export
//

export default summarizeRequest;

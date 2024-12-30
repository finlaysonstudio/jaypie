import expressCors from "cors";

//
//
// Constants
//

const HTTP_PROTOCOL = "http://";
const HTTPS_PROTOCOL = "https://";
const SANDBOX_ENV = "sandbox";

//
//
// Helper Functions
//

const ensureProtocol = (url) => {
  if (!url) return url;
  if (url.startsWith(HTTP_PROTOCOL) || url.startsWith(HTTPS_PROTOCOL))
    return url;
  return HTTPS_PROTOCOL + url;
};

//
//
// Main
//

const corsHelper = () => {
  const options = {
    origin(origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc)
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = [
        ensureProtocol(process.env.BASE_URL),
        ensureProtocol(process.env.PROJECT_BASE_URL),
      ];

      if (process.env.PROJECT_ENV === SANDBOX_ENV) {
        allowedOrigins.push("http://localhost");
        allowedOrigins.push(/^http:\/\/localhost:\d+$/);
      }

      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return origin.includes(allowed);
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };

  return expressCors(options);
};

//
//
// Export
//

export default corsHelper;

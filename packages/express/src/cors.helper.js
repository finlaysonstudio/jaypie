import expressCors from "cors";

//
//
// Constants
//

//
//
// Helper Functions
//

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
        process.env.BASE_URL,
        process.env.PROJECT_BASE_URL,
        "http://localhost",
        /^http:\/\/localhost:\d+$/,
      ];

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

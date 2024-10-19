//
//
// Main
//

/**
 * Returns key-value pairs that should be included in all logs
 * @param {{[key: string]: string}} withTags Tags to include for logger
 * @returns {Object} Provided plus default tags
 */
const logTags = (withTags) => {
  // Validate
  if (withTags && typeof withTags !== "object") {
    withTags = {};
  }

  // Setup
  const {
    PROJECT_COMMIT,
    PROJECT_ENV,
    PROJECT_KEY,
    PROJECT_SERVICE,
    PROJECT_SPONSOR,
    PROJECT_VERSION,
  } = process.env;

  // Process
  const tags = {};

  // Commit
  if (PROJECT_COMMIT) {
    tags.commit = PROJECT_COMMIT;
  }
  // Env
  if (PROJECT_ENV) {
    tags.env = PROJECT_ENV;
  }
  // Key (project name)
  if (PROJECT_KEY) {
    tags.project = PROJECT_KEY;
  }
  // Service
  if (PROJECT_SERVICE) {
    tags.service = PROJECT_SERVICE;
  }
  // Sponsor
  if (PROJECT_SPONSOR) {
    tags.sponsor = PROJECT_SPONSOR;
  }
  // Version
  if (process.env.npm_package_version || PROJECT_VERSION) {
    tags.version = process.env.npm_package_version || PROJECT_VERSION;
  }

  // Return
  return {
    ...tags,
    ...withTags,
  };
};

//
//
// Export
//

export default logTags;

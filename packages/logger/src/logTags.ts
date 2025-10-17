export function logTags(withTags?: Record<string, string>): Record<string, string> {
  if (withTags && typeof withTags !== "object") {
    withTags = {};
  }

  const {
    PROJECT_COMMIT,
    PROJECT_ENV,
    PROJECT_KEY,
    PROJECT_SERVICE,
    PROJECT_SPONSOR,
    PROJECT_VERSION,
  } = process.env;

  const tags: Record<string, string> = {};

  if (PROJECT_COMMIT) {
    tags.commit = PROJECT_COMMIT;
  }
  if (PROJECT_ENV) {
    tags.env = PROJECT_ENV;
  }
  if (PROJECT_KEY) {
    tags.project = PROJECT_KEY;
  }
  if (PROJECT_SERVICE) {
    tags.service = PROJECT_SERVICE;
  }
  if (PROJECT_SPONSOR) {
    tags.sponsor = PROJECT_SPONSOR;
  }
  if (process.env.npm_package_version || PROJECT_VERSION) {
    tags.version = (process.env.npm_package_version || PROJECT_VERSION) as string;
  }

  return {
    ...tags,
    ...withTags,
  };
}

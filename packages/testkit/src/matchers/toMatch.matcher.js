import {
  RE_BASE64_PATTERN,
  RE_JWT_PATTERN,
  RE_MONGO_ID_PATTERN,
  RE_SIGNED_COOKIE_PATTERN,
  RE_UUID_4_PATTERN,
  RE_UUID_5_PATTERN,
  RE_UUID_PATTERN,
} from "../constants.js";

//
//
// Helper
//

function forSubjectToMatchPattern(
  subject,
  pattern,
  { patternName = "pattern" } = {},
) {
  if (pattern.test(subject)) {
    return {
      message: () => `expected "${subject}" not to match ${patternName}`,
      pass: true,
    };
  }
  return {
    message: () => `expected "${subject}" to match ${patternName}`,
    pass: false,
  };
}

//
//
// Main
//

export const toMatchBase64 = subject =>
  forSubjectToMatchPattern(subject, RE_BASE64_PATTERN, {
    patternName: "Base64",
  });

export const toMatchJwt = subject =>
  forSubjectToMatchPattern(subject, RE_JWT_PATTERN, {
    patternName: "JWT",
  });

export const toMatchMongoId = subject =>
  forSubjectToMatchPattern(subject, RE_MONGO_ID_PATTERN, {
    patternName: "MongoDbId",
  });

export const toMatchSignedCookie = subject =>
  forSubjectToMatchPattern(subject, RE_SIGNED_COOKIE_PATTERN, {
    patternName: "Signed-Cookie",
  });

export const toMatchUuid4 = subject =>
  forSubjectToMatchPattern(subject, RE_UUID_4_PATTERN, {
    patternName: "UUIDv4",
  });

export const toMatchUuid5 = subject =>
  forSubjectToMatchPattern(subject, RE_UUID_5_PATTERN, {
    patternName: "UUIDv5",
  });

/**
 * Determines if subject matches a UUID pattern.
 * Does _NOT_ check if the UUID is valid.
 * @param {String} subject
 */
export const toMatchUuid = subject =>
  forSubjectToMatchPattern(subject, RE_UUID_PATTERN, {
    patternName: "UUID",
  });

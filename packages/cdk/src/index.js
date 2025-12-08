const {
  BadGatewayError,
  ConfigurationError,
  GatewayTimeoutError,
  IllogicalError,
  InternalError,
  MultiError,
  NotImplementedError,
  ProjectError,
  ProjectMultiError,
  UnavailableError,
  UnhandledError,
  UnreachableCodeError,
} = require("@jaypie/errors");

const { CDK } = require("./constants.js");
const cfnOutput = require("./cfnOutput.function.js");
const isValidHostname = require("./isValidHostname.function.js");
const isValidSubdomain = require("./isValidSubdomain.function.js");
const mergeDomain = require("./mergeDomain.function.js");
const projectTagger = require("./projectTagger.function.js");

//
//
// Export
//

module.exports = {
  CDK,
  cfnOutput,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
  projectTagger,
  BadGatewayError,
  ConfigurationError,
  GatewayTimeoutError,
  IllogicalError,
  InternalError,
  MultiError,
  NotImplementedError,
  ProjectError,
  ProjectMultiError,
  UnavailableError,
  UnhandledError,
  UnreachableCodeError,
};

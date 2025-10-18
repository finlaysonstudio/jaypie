import * as aws from "@jaypie/aws";
import * as core from "@jaypie/core";
import * as datadog from "@jaypie/datadog";
import * as express from "@jaypie/express";
import * as kit from "@jaypie/kit";
import * as lambda from "@jaypie/lambda";
import * as llm from "@jaypie/llm";
import * as logger from "@jaypie/logger";
import * as mongoose from "@jaypie/mongoose";
import * as textract from "@jaypie/textract";

export const original = {
  aws,
  core,
  datadog,
  express,
  kit,
  lambda,
  llm,
  logger,
  mongoose,
  textract,
};

export default original;

import * as aws from "@jaypie/aws";
import * as core from "@jaypie/core";
import * as datadog from "@jaypie/datadog";
import * as express from "@jaypie/express";
import * as lambda from "@jaypie/lambda";
import * as llm from "@jaypie/llm";
import * as mongoose from "@jaypie/mongoose";
import * as textract from "@jaypie/textract";

export const original = {
  aws,
  core,
  datadog,
  express,
  lambda,
  llm,
  mongoose,
  textract,
};

export default original;

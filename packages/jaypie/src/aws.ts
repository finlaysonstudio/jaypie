import { loadPackage } from "./loadPackage.js";
import type * as AwsTypes from "@jaypie/aws";

type AwsModule = typeof AwsTypes;

export function getEnvSecret(
  ...args: Parameters<AwsModule["getEnvSecret"]>
): ReturnType<AwsModule["getEnvSecret"]> {
  return loadPackage<AwsModule>("@jaypie/aws").getEnvSecret(...args);
}

export function getMessages(
  ...args: Parameters<AwsModule["getMessages"]>
): ReturnType<AwsModule["getMessages"]> {
  return loadPackage<AwsModule>("@jaypie/aws").getMessages(...args);
}

export function getSecret(
  ...args: Parameters<AwsModule["getSecret"]>
): ReturnType<AwsModule["getSecret"]> {
  return loadPackage<AwsModule>("@jaypie/aws").getSecret(...args);
}

export function getSingletonMessage(
  ...args: Parameters<AwsModule["getSingletonMessage"]>
): ReturnType<AwsModule["getSingletonMessage"]> {
  return loadPackage<AwsModule>("@jaypie/aws").getSingletonMessage(...args);
}

export function getTextractJob(
  ...args: Parameters<AwsModule["getTextractJob"]>
): ReturnType<AwsModule["getTextractJob"]> {
  return loadPackage<AwsModule>("@jaypie/aws").getTextractJob(...args);
}

export function sendBatchMessages(
  ...args: Parameters<AwsModule["sendBatchMessages"]>
): ReturnType<AwsModule["sendBatchMessages"]> {
  return loadPackage<AwsModule>("@jaypie/aws").sendBatchMessages(...args);
}

export function sendMessage(
  ...args: Parameters<AwsModule["sendMessage"]>
): ReturnType<AwsModule["sendMessage"]> {
  return loadPackage<AwsModule>("@jaypie/aws").sendMessage(...args);
}

export function sendTextractJob(
  ...args: Parameters<AwsModule["sendTextractJob"]>
): ReturnType<AwsModule["sendTextractJob"]> {
  return loadPackage<AwsModule>("@jaypie/aws").sendTextractJob(...args);
}

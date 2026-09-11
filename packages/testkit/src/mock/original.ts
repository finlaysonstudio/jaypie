// Packages the mocks wrap that a consumer may not install. Each loads once via
// a top-level dynamic import. A package that is not installed resolves to an
// empty module, so wrapped mocks fall back to their canned values and
// pass-through exports are undefined instead of failing to load. Types assume
// the package is present.

const MODULE_NOT_FOUND_CODES = ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"];

function isMissingPackage({
  error,
  packageName,
}: {
  error: unknown;
  packageName: string;
}): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const { code } = error as Error & { code?: string };
  return (
    MODULE_NOT_FOUND_CODES.includes(code ?? "") &&
    error.message.includes(`'${packageName}'`)
  );
}

export async function importOptional<T>(packageName: string): Promise<T> {
  try {
    return (await import(/* @vite-ignore */ packageName)) as T;
  } catch (error) {
    // Only the package itself being absent is tolerated. A missing transitive
    // dependency or an error thrown while loading still surfaces.
    if (isMissingPackage({ error, packageName })) {
      return {} as T;
    }
    throw error;
  }
}

export const aws =
  await importOptional<typeof import("@jaypie/aws")>("@jaypie/aws");
export const datadog =
  await importOptional<typeof import("@jaypie/datadog")>("@jaypie/datadog");
export const dynamodb =
  await importOptional<typeof import("@jaypie/dynamodb")>("@jaypie/dynamodb");
export const express =
  await importOptional<typeof import("@jaypie/express")>("@jaypie/express");
export const llm =
  await importOptional<typeof import("@jaypie/llm")>("@jaypie/llm");
export const textract =
  await importOptional<typeof import("@jaypie/textract")>("@jaypie/textract");
export const textractResponseParser = await importOptional<
  typeof import("amazon-textract-response-parser")
>("amazon-textract-response-parser");

import { loadEnvSecrets } from "@jaypie/aws";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[instrumentation] loadEnvSecrets starting", {
      hasSecretAuth0ClientSecret: !!process.env.SECRET_AUTH0_CLIENT_SECRET,
      hasSecretAuth0Secret: !!process.env.SECRET_AUTH0_SECRET,
      hasSecretProjectSalt: !!process.env.SECRET_PROJECT_SALT,
      hasSessionToken: !!process.env.AWS_SESSION_TOKEN,
    });
    try {
      await loadEnvSecrets(
        "AUTH0_CLIENT_SECRET",
        "AUTH0_SECRET",
        "PROJECT_SALT",
      );
      console.log("[instrumentation] loadEnvSecrets complete", {
        hasAuth0ClientSecret: !!process.env.AUTH0_CLIENT_SECRET,
        hasAuth0Secret: !!process.env.AUTH0_SECRET,
        hasProjectSalt: !!process.env.PROJECT_SALT,
      });
    } catch (error) {
      console.error("[instrumentation] loadEnvSecrets FAILED", error);
    }
  }
}

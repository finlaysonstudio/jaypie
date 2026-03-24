import { loadEnvSecrets } from "@jaypie/aws";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await loadEnvSecrets(
      "AUTH0_CLIENT_SECRET",
      "AUTH0_SECRET",
      "PROJECT_SALT",
    );
  }
}

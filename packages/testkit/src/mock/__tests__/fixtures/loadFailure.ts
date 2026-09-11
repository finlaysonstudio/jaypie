import { ConfigurationError } from "@jaypie/errors";

// Throws while loading so importOptional can prove it rethrows
throw new ConfigurationError("_MOCK_LOAD_FAILURE");

import { vi } from "vitest";

/**
 * Initialize the mock environment
 */
export function setupMockEnvironment(): void {
  // Add environment variables needed for tests
  process.env.STAGE = "test";
  process.env.NODE_ENV = "test";

  // Clear all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Reset mocked modules between tests
  afterEach(() => {
    vi.resetModules();
  });
}

/**
 * Restore all mocks to their original state
 */
export function teardownMockEnvironment(): void {
  vi.restoreAllMocks();
}

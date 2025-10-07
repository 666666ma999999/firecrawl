import { config } from "../config";
import { PostHog } from "posthog-node";
import { logger } from "../../src/lib/logger";

function PostHogClient(apiKey: string) {
  if (!config.POSTHOG_HOST) {
    throw new Error(
      "POSTHOG_HOST is not defined, but POSTHOG_API_KEY is. Ensure both are set to use PostHog. If you do not wish to use PostHog, unset POSTHOG_API_KEY.",
    );
  }

  const posthogClient = new PostHog(apiKey, {
    host: config.POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return posthogClient;
}

class MockPostHog {
  capture() {}
}

// Using the actual PostHog class if POSTHOG_API_KEY exists, otherwise using the mock class
// Additionally, print a warning to the terminal if POSTHOG_API_KEY is not provided
export const posthog = config.POSTHOG_API_KEY
  ? PostHogClient(config.POSTHOG_API_KEY)
  : (() => {
      logger.warn(
        "POSTHOG_API_KEY is not provided - your events will not be logged. Using MockPostHog as a fallback. See posthog.ts for more.",
      );
      return new MockPostHog();
    })();

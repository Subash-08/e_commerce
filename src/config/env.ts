import "server-only";
import { z } from "zod";

const foundationEnv = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  APP_URL: z.url().optional(),
});

// Future infrastructure adapters must validate their own required secret groups
// before becoming active. No provider is enabled by this scaffold.
export function readFoundationEnvironment() {
  return foundationEnv.parse({
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    APP_URL: process.env.APP_URL,
  });
}

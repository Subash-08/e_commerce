import "server-only";
import { z } from "zod";
import { DatabaseError } from "./errors.ts";
const schema = z.object({
 APP_ENV: z.enum(["development","test","staging","production"]),
 NODE_ENV: z.enum(["development","test","production"]),
 MONGODB_URI: z.string().min(1).refine(v => /^mongodb(?:\+srv)?:\/\//.test(v)),
 MONGODB_DB_NAME: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/),
 MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),
 APP_RUNTIME: z.enum(["serverless","long-running"]).default("serverless"),
});
export type DatabaseConfig = Readonly<{
 uri: string; databaseName: string; maxPoolSize: number;
 environment: "development" | "test" | "staging" | "production";
 runtime: "serverless" | "long-running";
}>;
export function assertTestDatabase(databaseName: string) {
 if (!/^[a-zA-Z][a-zA-Z0-9_]*_test$/.test(databaseName)) throw new DatabaseError("DB_UNSAFE_TARGET");
}
export function parseDatabaseConfig(input: Record<string, unknown>): DatabaseConfig {
 const parsed = schema.safeParse(input);
 if (!parsed.success) throw new DatabaseError("DB_CONFIG_INVALID");
 const v = parsed.data;
 if (v.NODE_ENV === "test" || v.APP_ENV === "test") {
  if (v.NODE_ENV !== "test" || v.APP_ENV !== "test") throw new DatabaseError("DB_UNSAFE_TARGET");
  assertTestDatabase(v.MONGODB_DB_NAME);
 } else if (v.MONGODB_DB_NAME.endsWith("_test")) throw new DatabaseError("DB_UNSAFE_TARGET");
 return Object.freeze({ uri:v.MONGODB_URI, databaseName:v.MONGODB_DB_NAME, maxPoolSize:v.MONGODB_MAX_POOL_SIZE, environment:v.APP_ENV, runtime:v.APP_RUNTIME });
}
export function readDatabaseConfig(): DatabaseConfig {
 return parseDatabaseConfig({
  NODE_ENV: process.env.NODE_ENV ?? "development",
  APP_ENV: process.env.APP_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
  APP_RUNTIME: process.env.APP_RUNTIME,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
  MONGODB_MAX_POOL_SIZE: process.env.MONGODB_MAX_POOL_SIZE,
 });
}

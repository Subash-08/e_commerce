import { randomBytes, randomUUID } from "node:crypto";
export function identityUserFixture() {
  return {
    name: "Account test",
    email: randomUUID() + "@example.test",
    password: randomBytes(24).toString("base64url"),
  };
}

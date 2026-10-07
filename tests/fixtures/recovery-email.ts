import { randomBytes } from "node:crypto";
export function recoveryEmailFixture() {
  return {
    APP_ENV: "test",
    APP_URL: "http://localhost:3000",
    EMAIL_PROVIDER: "resend",
    EMAIL_FROM: "sender@example.test",
    RESEND_API_KEY: randomBytes(32).toString("hex"),
    N8N_WEBHOOK_URL: "http://localhost:5678/webhook/auth-mail",
    N8N_WEBHOOK_SECRET: randomBytes(32).toString("hex"),
  };
}
export function recoveryMessageFixture() {
  return {
    email: "customer@example.test",
    url:
      "http://localhost:3000/api/auth/reset-password/" +
      randomBytes(24).toString("hex") +
      "?callbackURL=http%3A%2F%2Flocalhost%3A3000%2Freset-password",
  };
}

import { describe, expect, it, vi } from "vitest";
import {
  createRecoverySender,
  readRecoveryEmailConfig,
} from "../../src/modules/notifications/recovery-email";
import {
  recoveryEmailFixture,
  recoveryMessageFixture,
} from "../fixtures/recovery-email";

describe("recovery email delivery", () => {
  it("sends Resend's contract with stable idempotency and no n8n fallback", async () => {
    const environment = recoveryEmailFixture();
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ id: "accepted-message" }));
    const sender = createRecoverySender(
      readRecoveryEmailConfig(environment),
      request,
    );
    const message = recoveryMessageFixture();
    await sender(message);
    request.mockResolvedValue(Response.json({ id: "accepted-message" }));
    await sender(message);
    const [endpoint, options] = request.mock.calls[0];
    expect(endpoint).toBe("https://api.resend.com/emails");
    expect(options?.redirect).toBe("error");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(
      new Headers(options?.headers).get("authorization") ===
        `Bearer ${environment.RESEND_API_KEY}`,
    ).toBe(true);
    expect(new Headers(options?.headers).get("idempotency-key")).toBe(
      new Headers(request.mock.calls[1][1]?.headers).get("idempotency-key"),
    );
    const payload = JSON.parse(String(options?.body));
    expect(payload.to).toEqual([message.email]);
    expect(payload.text.includes(message.url)).toBe(true);
    expect(payload.requestId).toBeUndefined();
  });
  it("sends an authenticated n8n envelope and requires a matching explicit acknowledgement", async () => {
    const environment = {
      ...recoveryEmailFixture(),
      EMAIL_PROVIDER: "n8n",
      RESEND_API_KEY: undefined,
    };
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_endpoint, options) => {
        const body = JSON.parse(String(options?.body));
        expect(body.event).toBe("auth.password-reset.email");
        expect(body.schemaVersion).toBe(1);
        expect(body.message.to).toHaveLength(1);
        expect(
          new Headers(options?.headers).get("x-commerce-webhook-secret") ===
            environment.N8N_WEBHOOK_SECRET,
        ).toBe(true);
        expect(new Headers(options?.headers).has("authorization")).toBe(false);
        return Response.json({ accepted: true, requestId: body.requestId });
      });
    await createRecoverySender(
      readRecoveryEmailConfig(environment),
      request,
    )(recoveryMessageFixture());
    expect(request.mock.calls[0][0]).toBe(environment.N8N_WEBHOOK_URL);
  });
  it.each(["rejected", "started", "wrong-id", "network"])(
    "fails safely without retry/fallback on %s",
    async (failure) => {
      const request = vi.fn<typeof fetch>().mockImplementation(async () => {
        if (failure === "network") throw new Error("untrusted provider detail");
        if (failure === "rejected")
          return new Response("private provider detail", { status: 429 });
        if (failure === "started") return new Response("Workflow got started");
        return Response.json({ accepted: true, requestId: "wrong" });
      });
      const config = readRecoveryEmailConfig({
        ...recoveryEmailFixture(),
        EMAIL_PROVIDER: "n8n",
      });
      await expect(
        createRecoverySender(config, request)(recoveryMessageFixture()),
      ).rejects.toMatchObject({ message: "EMAIL_DELIVERY_FAILED" });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects missing selected credentials, unsafe production URLs and provider typos", () => {
    const fixture = recoveryEmailFixture();
    for (const changes of [
      { EMAIL_PROVIDER: "unknown" },
      { RESEND_API_KEY: "" },
      { EMAIL_PROVIDER: "n8n", N8N_WEBHOOK_SECRET: "" },
      { APP_ENV: "production" },
      {
        APP_ENV: "production",
        APP_URL: "https://shop.example.test",
        EMAIL_PROVIDER: "n8n",
        N8N_WEBHOOK_URL: "https://workflow.example.test/webhook-test/mail",
      },
    ])
      expect(() => readRecoveryEmailConfig({ ...fixture, ...changes })).toThrow(
        "EMAIL_CONFIG_INVALID",
      );
  });
  it("rejects a reset link outside the application's auth route before delivery", async () => {
    const request = vi.fn<typeof fetch>();
    const sender = createRecoverySender(
      readRecoveryEmailConfig(recoveryEmailFixture()),
      request,
    );
    await expect(
      sender({
        ...recoveryMessageFixture(),
        url: "https://other.example.test/reset",
      }),
    ).rejects.toMatchObject({ code: "EMAIL_MESSAGE_INVALID" });
    expect(request).not.toHaveBeenCalled();
  });
});

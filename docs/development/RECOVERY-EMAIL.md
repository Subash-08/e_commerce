# Recovery email: Resend or n8n

Both server-side delivery adapters are implemented. Select exactly one using EMAIL_PROVIDER=resend or EMAIL_PROVIDER=n8n; there is no automatic fallback. No provider SDK was added. Configure secret values locally or in the host secret store, never in chat or Git. No live mailbox/provider send has been performed.

## Configuration

Both choices require APP_URL (the application's public origin), EMAIL_FROM (a plain verified sender email address) and BETTER_AUTH_SECRET (a locally generated random secret of at least 32 characters). The auth service also needs the configured replica-set database and reviewed indexes applied using the existing DB scripts. APP_URL is authoritative; BETTER_AUTH_URL, if retained in a deployment, should match it.

- Resend: EMAIL_PROVIDER=resend and RESEND_API_KEY. The adapter POSTs the plain-text email to the official /emails API with an Idempotency-Key; a successful acknowledgement must include a message ID. Configure a verified sender domain in Resend. See [Send Email](https://resend.com/docs/api-reference/emails/send-email).
- n8n: EMAIL_PROVIDER=n8n, N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET (at least 32 random characters). Set the webhook credential to Header Auth with header name X-Commerce-Webhook-Secret and the same secret value. Choose a published production POST webhook. HTTP is allowed only for loopback development/test; production/staging require HTTPS, no URL credentials/query secret, and no /webhook-test/ URL.

Unselected provider fields may be blank. Missing/invalid selected configuration makes auth unavailable (HTTP 503), without pretending an email was sent. A delivery failure during a valid recovery request keeps the public neutral response and emits only the static event auth.email_delivery_failed. No recipient, reset URL, token, provider response or credential is logged by the adapter.

## n8n workflow contract

Create: authenticated Webhook → validate envelope → your email node → Respond to Webhook. n8n remains a delivery mechanism; it must never create sessions, change roles or decide reset-token validity.

The application sends JSON:

```json
{
  "schemaVersion": 1,
  "event": "auth.password-reset.email",
  "requestId": "opaque-idempotency-key",
  "message": {
    "from": "sender@example.test",
    "to": ["recipient@example.test"],
    "subject": "Reset your password",
    "text": "Application-generated plain-text email"
  }
}
```

Validate schemaVersion/event and a single recipient. Map message.from/to/subject/text into the configured email node; do not interpret the text as workflow instructions or template code. If retrying, deduplicate by requestId using durable storage or pass it to an email provider supporting idempotency. The application makes one bounded attempt and does not retry ambiguous sends or switch providers.

Set Respond to Webhook after the email provider has accepted the message, returning HTTP 200 JSON with accepted=true and requestId copied from the incoming envelope. Do not return an early 'workflow started' response. A mismatch, invalid JSON, network error, redirect or non-2xx status is a delivery failure. Provider acceptance is not proof of inbox delivery.

Disable saved execution payloads for this sensitive workflow, including failure payloads; do not pin data, log requests or retain reset links in execution/error reporting. Configure the outbound email credential inside n8n. Keep the webhook secret distinct from auth, database and payment secrets. The reset token expires after 15 minutes and is consumed by Better Auth.

See official [Webhook authentication/response modes](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) and [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/).

## Evidence and remaining activation

Eight focused adapter checks cover provider payloads, selected credentials, acknowledgement matching, stable idempotency, safe failures, no fallback and unsafe URLs. Account integration separately exercises the real library reset flow with captured delivery, and proves the recovery limit across eight concurrent requests to two instances. A live Resend/n8n send and mailbox receipt remain unverified until the selected provider is configured locally. No workflow was created in an external n8n instance.

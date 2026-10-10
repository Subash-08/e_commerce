# Vercel payment staging

Selected by the user on 2026-10-10: https://e-commerce-gules-iota-16.vercel.app.

Home and login returned HTTP 200 without a Vercel login challenge. No authenticated session, Atlas connection, payment callback or webhook delivery has been verified on this deployment. Phase 2B.2 has a local implementation checkpoint: callback and webhook routes exist, but deployed Razorpay delivery and worker execution are not yet verified. Do not enable live checkout based on deployment alone.

## Environment settings

In Vercel Project Settings, configure the environment that actually serves this hostname. A stable project URL may point to Vercel's Production deployment even though this application is being used for staging. Set APP_ENV explicitly to staging there; do not infer it from VERCEL_ENV. Preview-only variables do not configure a Production deployment.

| Name                    | Staging value/source                                            |
| ----------------------- | --------------------------------------------------------------- |
| APP_ENV                 | staging                                                         |
| APP_RUNTIME             | serverless                                                      |
| APP_URL                 | https://e-commerce-gules-iota-16.vercel.app                     |
| BETTER_AUTH_URL         | https://e-commerce-gules-iota-16.vercel.app                     |
| MONGODB_URI             | Existing Atlas URI, entered privately                           |
| MONGODB_DB_NAME         | Explicit non-production database used for this staging exercise |
| MONGODB_MAX_POOL_SIZE   | 5 initially; budget connections across instances                |
| BETTER_AUTH_SECRET      | Stable strong secret, entered privately                         |
| RAZORPAY_MODE           | test                                                            |
| RAZORPAY_KEY_ID         | Razorpay test key ID                                            |
| RAZORPAY_KEY_SECRET     | Corresponding test key secret, entered privately                |
| RAZORPAY_WEBHOOK_SECRET | Dedicated webhook signing secret, entered privately             |
| JOBS_TRIGGER_SECRET     | Strong private scheduler bearer secret                          |

Use the existing Cloudinary variables and either Resend or n8n email settings from .env.example as needed. Local environment files are not uploaded automatically. Never prefix secrets with NEXT_PUBLIC_. Never commit real values. Do not set NODE_ENV=test: Vercel builds the Next app in production mode while APP_ENV=staging controls application policy. Local development retains its existing APP_ENV.

Choose Next.js, repository root, Node 24.x, install npm ci, build npm run build, and the framework's default output. Do not use the local .tools runtime or npm run dev on Vercel. Vercel controls Node patch versions; the local exact pin is not a guarantee of its runtime patch. Redeploy after changing environment values.

## Payment verification gate

After the 2B.2 commit is deployed, the Test Mode webhook is https://e-commerce-gules-iota-16.vercel.app/api/webhooks/razorpay. Configure it in Razorpay Test Mode only, using the same webhook secret as Vercel. Select only `payment.authorized`, `payment.captured`, and `payment.failed`. Do not select `order.paid`; payment evidence is fetched directly from Razorpay. Vercel Deployment Protection must permit provider delivery; website reachability alone does not verify the webhook path. Retain signature checks even if the route is publicly reachable.

Use the same deployed site for login, order acceptance and checkout. A Vercel webhook cannot process localhost-only code. The deployed app must reach the Atlas database containing the accepted test order. Existing administrators in another database do not grant access here; use the approved bootstrap for the selected database when needed.

The existing jobs endpoint expects authenticated POST /api/jobs/run. Vercel native cron sends GET and is not a drop-in scheduler for this implementation. Keep the approved authenticated external scheduler or implement a reviewed adapter later. Staging must exercise durable webhook processing before claiming success. No paid scheduler purchase, live payment or production launch is authorized by this setup.

Official references: [environment scopes](https://vercel.com/docs/environment-variables), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [deployment protection bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection).

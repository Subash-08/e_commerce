# Credentials and local configuration

Do not paste secrets into chat or commit them. A database password was disclosed in the conversation: rotate that Atlas database user's password before use. No connection to Atlas or collection creation was performed by the UI work.

## MongoDB: needed for persistent development only

The no-Docker ephemeral database launcher still needs no credentials.

For Atlas, create or update an ignored local file in your editor, such as .env.development.local. Keep any existing entries. Codex must not read this file. Use these keys with your replacement credentials:

```dotenv
APP_ENV=development
APP_RUNTIME=long-running
MONGODB_URI=mongodb+srv://USERNAME:URL_ENCODED_PASSWORD@YOUR_CLUSTER/e_commerce?appName=Cluster0
MONGODB_DB_NAME=e_commerce
MONGODB_MAX_POOL_SIZE=5
```

e_commerce is a database, not a collection. Both database settings must agree until the outstanding native/Mongoose selection review is resolved. The sample is a format template, not a valid connection string. URL-encode password characters; do not put a backslash before the separating @. Never use this Atlas database as an integration-test target.

In Atlas, authorize your development machine's IP in Network Access and limit the database user's permissions to the intended database. Verify the cluster is available. Do not create placeholder commerce collections manually: reviewed schemas/indexes and the later catalog stage determine them. Selecting a database in a URI does not itself create collections.

Restart the development server after editing configuration. GET /api/ready reports only ok or degraded, without revealing connection details. A readiness ping does not prove transaction/index/auth compatibility or close Stage 4B.

## Later integrations: prepare only when their slice is authorized

| Integration | Required configuration | Timing |
| --- | --- | --- |
| Auth | Locally generated secret, base URL, selected recovery email transport | After ADR 0003 compatibility decision |
| Email | One provider API key or SMTP credentials, verified sender/domain | Recovery or notification integration |
| Razorpay | Test key ID/secret and separate webhook secret | Test payment slice; no live keys now |
| Cloudinary | Cloud name, API key/secret and upload policy | Media integration |
| Jobs | Locally generated trigger secret and selected scheduler | Durable runner deployment |
| Private invoices | Selected storage credentials and access policy | Invoice artifact integration |
| Deployment | Host access, production Atlas configuration, domain/DNS and monitoring | Staging/launch authorization |

Keep server secrets out of NEXT_PUBLIC_ variables. Ask for non-secret provider choices in chat; enter credential values through local configuration or the deployment secret store.

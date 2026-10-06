# System architecture

Approved decisions are in [architecture record](ARCHITECTURE-DECISIONS.md). The application is a single Next.js deployment per client with a separate managed Atlas database. Storefront and admin share domain services but have separate root layouts and authorization boundaries.

Browser requests enter Server Components, Server Actions or Route Handlers. These validate input and session context, invoke a module service, and return a minimal DTO. Services use repositories and pure pricing/state functions. Only server code accesses MongoDB, provider secrets and private artifacts. Server Components do not make HTTP calls to their own APIs.

Cloudinary serves public catalog assets. Razorpay confirms external payment truth. MongoDB owns internal orders and historical ledgers. Email/n8n/analytics are asynchronous and cannot gate payment correctness. MongoDB contains a small jobs collection for bounded retryable work; there is no external queue baseline.

Two deployment adapters: Node on VPS (preferred cost-focused path; Nginx/process supervision or Docker as appropriate) and paid Vercel convenience. Business services know neither provider. An external authenticated scheduler can call the same protected runner when the host cannot meet the 1–5 minute schedule.

Core critical path: validate -> pure pricing -> conditional tracked reservation/coupon claim -> order snapshot -> provider binding -> verified capture transition. Cross-system failure is recovered, not hidden behind a database transaction containing HTTP calls.

Connection ownership: one process-local shared native MongoClient reused by Mongoose setClient and Better Auth adapter; see [auth ADR](../adr/0003-auth-and-connections.md). One per process is not one global connection across all serverless instances.

Extension boundaries: shipping/tax policy input, payment adapter, media service and notifications have typed contracts. A client may select supported policy/configuration, but cannot override transaction invariants. No speculative service container or plugin registry.

[Diagrams](../diagrams/CORE-FLOWS.md) describe trust boundaries, transactions and asynchronous recovery. No diagram implies exactly-once transport delivery.

# Core architecture diagrams

These diagrams illustrate the contracts in [approved decisions](../architecture/ARCHITECTURE-DECISIONS.md) and [canonical state registry](../commerce/STATE-MACHINES.md). Dotted arrows indicate asynchronous work. Illustrative state diagrams omit some guards; the registry is authoritative.

## 1. System context and trust boundaries

```mermaid
flowchart TB
  subgraph Untrusted["Browser boundary"]
    Buyer["Guest or account buyer"]
    Staff["Staff or admin"]
  end
  subgraph App["One client Next.js application"]
    Store["Store root"]
    Admin["Admin root"]
    Guard["Validation and authorization"]
    Domain["Commerce services and pure rules"]
    Runner["Small durable job runner"]
    Store --> Guard
    Admin --> Guard
    Guard --> Domain
  end
  Buyer --> Store
  Staff --> Admin
  subgraph Persistence["Private persistence"]
    DB[("Managed MongoDB Atlas")]
    Files["Private invoice and import artifacts"]
  end
  Domain --> DB
  Domain --> Files
  DB -. "durable jobs" .-> Runner
  subgraph Providers["External provider boundary"]
    Razorpay["Razorpay payment truth"]
    Cloudinary["Cloudinary public media"]
    Email["Email and n8n"]
  end
  Domain --> Razorpay
  Razorpay -->|"verified webhook"| Guard
  Store --> Cloudinary
  Runner -. "noncritical notification" .-> Email
```

## 2. Feature dependencies

```mermaid
flowchart LR
  Identity["Identity and roles"] --> Checkout
  Settings["Store policies"] --> Pricing
  Taxonomy["Categories and brands"] --> Catalog
  Attributes["Typed attributes"] --> Catalog
  Catalog["Product and stable variants"] --> Public["Public catalog and SEO"]
  Catalog --> Shopping["Cart and wishlist"]
  Shopping --> Checkout
  Pricing["Pure pricing engine"] --> Checkout
  Checkout --> Orders
  Orders --> Payments
  Payments --> Fulfillment
  Orders --> Invoices
  Payments --> Invoices
  Catalog --> Imports["CSV via catalog service"]
  Orders --> Reports
  Payments --> Reports
```

## 3. Conceptual entity relationships

```mermaid
erDiagram
  PRODUCT ||--|{ VARIANT : has
  CATEGORY ||--o{ PRODUCT : groups
  BRAND o|--o{ PRODUCT : brands
  ATTRIBUTE ||--o{ OPTION : defines
  VARIANT }o--o{ OPTION : selects
  AUTH_USER ||--o| PROFILE : owns
  AUTH_USER o|--o{ ORDER : optionally_owns
  ORDER ||--|{ ORDER_LINE : snapshots
  VARIANT ||--o{ ORDER_LINE : referenced_by
  ORDER ||--o{ PAYMENT : attempts
  PAYMENT ||--o{ REFUND : returns
  ORDER ||--o{ RESERVATION : tracked_only
  VARIANT ||--o{ RESERVATION : reserves
  ORDER ||--o{ INVOICE : documented_by
  INVOICE ||--o{ CREDIT_NOTE : corrected_by
  COUPON ||--o{ COUPON_CLAIM : limits
  ORDER ||--o{ COUPON_CLAIM : holds
  WEBHOOK_EVENT ||--o{ JOB : processed_by
```

Order lines retain data even if the referenced catalog entity is archived. Auth user is optional for guest orders. A database relationship does not imply cascade deletion.

## 4. Checkout with optional reservations

```mermaid
sequenceDiagram
  actor Buyer
  participant App
  participant Price as Pure pricing
  participant DB as MongoDB
  participant Pay as Razorpay
  Buyer->>App: Review IDs, address, coupon
  App->>DB: Fresh validated facts
  App->>Price: Facts and policy versions
  Price-->>App: Deterministic quote
  App-->>Buyer: Review final quote
  Buyer->>App: Accept quote and idempotency key
  App->>DB: Revalidate revisions and begin transaction
  alt Quantity tracked lines
    App->>DB: Conditional reserve tracked lines
  else Status only lines
    App->>DB: Validate availability without reservations
  end
  App->>DB: Snapshot order, coupon claim, required jobs; commit
  App->>Pay: Create provider order outside DB transaction
  alt Response known
    Pay-->>App: Provider order ID
    App->>DB: Bind provider order
    App-->>Buyer: Open payment
  else Timeout after possible remote success
    App->>DB: Mark binding UNKNOWN and reconcile
    App-->>Buyer: Pending; no blind duplicate creation
  end
```

## 5. Callback and webhook convergence

```mermaid
sequenceDiagram
  participant Browser
  participant API
  participant Pay as Razorpay
  participant DB as MongoDB
  participant Worker
  par Callback may arrive first or last
    Browser->>API: Payment IDs and signature
    API->>Pay: Verify trusted captured payment
    API->>DB: Guarded shared payment transition
  and Webhook may duplicate or reorder
    Pay->>API: Signed raw event
    API->>API: Validate raw HMAC and payload
    API->>DB: Insert unique event plus job atomically
    API-->>Pay: ACK only after durable ingest
    Worker->>DB: Claim leased job
    Worker->>Pay: Reconcile trusted facts if needed
    Worker->>DB: Same guarded payment transition
  end
  Note over DB: Unique payment ID and state guards prevent repeated effects
  DB-->>Worker: Durable notification or exception work
```

## 6. Order lifecycle and late capture

```mermaid
stateDiagram-v2
  [*] --> PENDING_PAYMENT: online accepted quote
  [*] --> PLACED: accepted COD
  PENDING_PAYMENT --> PLACED: verified capture
  PENDING_PAYMENT --> EXPIRED: deadline and guarded release
  PENDING_PAYMENT --> CANCELLED: authorized cancellation
  PLACED --> CONFIRMED
  CONFIRMED --> PROCESSING
  PROCESSING --> SHIPPED: fulfillment guards pass
  SHIPPED --> DELIVERED
  PLACED --> CANCELLED
  CONFIRMED --> CANCELLED
  PROCESSING --> CANCELLED
  EXPIRED --> PLACED: late capture and atomic recovery succeeds
  EXPIRED --> EXPIRED: late capture fails recovery; refund required
  CANCELLED --> CANCELLED: late capture; refund required
```

## 7. Payment observations

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> AUTHORIZED: trusted provider evidence
  AUTHORIZED --> CAPTURED: trusted capture
  PENDING --> CAPTURED: captured event first
  PENDING --> FAILED: definitive failure
  AUTHORIZED --> FAILED: definitive provider failure
  FAILED --> CAPTURED: later verified correction
  CAPTURED --> CAPTURED: duplicate observation has no effect
```

Refund state and order financial summary remain separate; refund does not change CAPTURED back to FAILED.

## 8. Product mutation impact

```mermaid
flowchart TB
  Edit["Authorized editor or CSV"] --> Validate["Validate expected revision and input"]
  Validate --> Tx["Commit catalog and projection plus invalidation job"]
  Tx --> Tags["Invalidate product, catalog, old and new taxonomy"]
  Tags --> Public["Detail, listing, home, search, SEO and sitemap"]
  Tags --> Redirect["Old slug redirect when changed"]
  Tx --> Fresh["Cart and wishlist resolve fresh references"]
  Fresh --> Quote["Checkout revalidates uncached"]
  Tx -. "failure retries via outbox" .-> Tags
  Frozen["Existing orders and issued invoices stay unchanged"]
```

## 9. Shopping live resolution

```mermaid
flowchart LR
  Guest["Guest local IDs"] --> Resolve["Bounded server resolution"]
  Account["Owned DB cart or wishlist"] --> Resolve
  Resolve --> Current["Current public product and variant"]
  Current --> Valid{"Available?"}
  Valid -->|yes| Display["Current name, media and price"]
  Valid -->|no| Explain["Unavailable line; excluded from totals"]
  Display --> Review["Fresh checkout validation"]
  Explain --> Remove["Remove or explicitly reselect"]
```

## 10. CSV import and resumability

```mermaid
flowchart TB
  Upload["Private immutable CSV upload"] --> Parse["Bounded parse and normalize"]
  Parse --> Preview["Validate SKU, options, prices, revisions"]
  Preview --> Confirm["User confirms input hash, mode and preview"]
  Confirm --> Job["Durable bounded chunk job"]
  Job --> Service["Same catalog service and row operation identity"]
  Service --> OK["Committed rows"]
  Service --> Error["Conflict or invalid row"]
  OK --> Summary["Counts and private error report"]
  Error --> Summary
  Job -. "crash retry with lease fencing" .-> Job
```

## 11. Provider-neutral deployment

```mermaid
flowchart TB
  Base["Reusable Next.js application"] --> VPS["VPS Node behind Nginx; Docker optional"]
  Base --> Vercel["Paid Vercel"]
  VPS --> Atlas[("Managed Atlas per-client database")]
  Vercel --> Atlas
  VPS --> Media["Cloudinary"]
  Vercel --> Media
  Native["Native scheduler every 1 to 5 minutes"] --> Runner["Protected bounded jobs runner"]
  External["External authenticated scheduler fallback"] --> Runner
  Runner --> Atlas
  Atlas --> Backup["Verified backups and restore drills"]
```

## Validation status

Eleven Mermaid blocks are authored with bounded standard flowchart, sequence, state and ER syntax. Structural checks and semantic review run in Stage 2. Mermaid CLI was not found in installed/bundled tooling; no package was installed. Full parser/render validation remains an explicit Stage 3 gate, not a claimed passing check.

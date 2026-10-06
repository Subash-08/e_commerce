# Invoice and label rules

Invoice issue timing is an explicit client/CA-reviewed policy for online/COD goods; do not equate every payment event with legal issue time. The state registry owns issue/void states.

Issue transaction validates eligible order, absence of existing issueKey and stable order snapshot; increments seller/FY/series counter; inserts immutable invoice and render job. Unique index plus transaction prevents duplicate numbers under concurrency. Financial year boundary uses Asia/Kolkata and configured legal seller identity. Multiple series require documented CA approval.

Legal seller/buyer/address/items/discount/tax/totals and policy/template versions are frozen. A failed PDF render reuses the same document/number. Numbering is an auditable consecutive issue ledger; preserve voided records and reasons. Never recycle a number after committed issue or reorder old numbers to remove gaps. Corrections use linked credit/debit documents per reviewed policy, not editing the issued original.

@react-pdf/renderer is proposed when invoice implementation starts. Generate using snapshots only; embed licensed Unicode/rupee-capable fonts; paginate long tables, addresses and notes; assert line/tax/grand-total equality. Avoid Chromium in application invoice generation. Store private artifact key/hash; authorized owner/admin/verified guest grants download. Private download sets no-store and attachment headers; no public Cloudinary delivery for invoices.

Basic shipping labels contain sender/receiver/order/tracking and optional COD due amount from order/receipt facts, not current cart. Labels are private PII, not SEO content.

Client review before production: GST registration/HSN/place of supply, legal issue date, series/length, tax rounding, e-invoicing applicability, retention and credit-note rules. See official references in [research](../research/COMMERCE-REFERENCES.md); no legal compliance is asserted by this design.

Tests: concurrent issue returns one immutable invoice; render retry yields same number; year rollover and void audit; old product/address/tax changes do not alter PDF facts; full/partial refund preserves source invoice; unauthorized download denied.

# Pricing rules

Phase 1A delivery implementation: [ADR 0012](../adr/0012-shipping-policy-and-calculation.md). Shipping is India/INR only; all amounts are paise. The threshold uses discounted GST-inclusive goods payable, excludes delivery/COD, and qualifies at equality. Separate delivery/COD taxes reuse calculateTax; no guessed rate or duplicated floating-point formula. A zero configured fee is permitted; disabled/unsupported delivery is unavailable, not free. Missing/unreviewed tax facts block authoritative calculation; Admin estimates are clearly labelled. FREE_SHIPPING remains a later atomic pricing/coupon/UI change.

One pure pricing engine receives validated current catalog, address, coupon, shipping and tax facts. It does not fetch DB/provider data. All monetary input/output is integer paise, nonnegative and bounded to a safe maximum chosen below JS safe integer overflow. Percentage/tax rates are integer basis points. Use integer/rational intermediates (BigInt internally if necessary) with explicit conversion bounds; no binary floating-point money operations.

## Calculation order

1. Validate active product/variant, supported country/currency, integer quantity and price revision. MRP >= selling price. Quantity is not a money decimal.
2. List subtotal = sum(MRP * quantity); item discount = sum((MRP - sale) * quantity). MRP discount is informational; never subtract it twice from sale totals.
3. Determine eligible sale amounts for one coupon. FIXED value is paise; PERCENTAGE value is basis points. Cap at eligible amount and configured maximum; enforce dates/minimum/usage claims.
4. Allocate coupon across eligible lines proportional to their eligible sale amounts. Floor initial allocations, distribute remaining paise by descending fractional remainder, tie-break by stable line key. Sum allocations exactly equals coupon discount. Shipping is excluded initially.
5. For inclusive lines, discounted payable gross is the discounted sale amount; extract base as roundHalfUp(gross * 10000 / (10000 + taxRateBps)); tax = gross - base. For exclusive lines, discounted sale amount is base; tax = roundHalfUp(base * rate / 10000). Use client-reviewed tax basis and allocation rules.
6. Resolve shipping by configured eligible discounted goods value; default free-threshold comparison uses discounted goods payable including goods tax, excluding shipping. Flat charge tax treatment is explicit. No secret carrier calculation in browser.
7. Total = sum(line base + line tax) + shipping base + shipping tax + rounding adjustment. Initial rounding adjustment is zero; do not round payment to rupees without client-approved policy.
8. Present final quote with changed-price/unavailable notices. The accepted order records exact inputs, allocations, policy and pricing engine versions.

Tax selection uses validated seller/place-of-supply facts. Domestic intra/inter-state split is policy-reviewed; GST disabled/exempt cases must be explicit, not fallback tax=0 on error. Split odd tax paise deterministically between components and store the allocation; CA approves legal rounding/line-vs-document method before production. Unsupported exports/special supplies fail validation.

## Worked acceptance examples

- Exclusive base 10,000 paise at 18% (1800 bps) => tax 1,800, payable 11,800.
- Inclusive gross 11,800 paise at 1800 bps => base 10,000, tax 1,800.
- Eligible gross lines 10,000 and 5,000 with a 1,000-paise fixed coupon => allocations 667 and 333; line gross 9,333 and 4,667; combined discount exactly 1,000.
- A 1-paise discount on three equal lines is assigned to the lowest stable line key after ties, not lost.
- Quantity 2 at 5,000 sale with MRP 6,000 gives sale gross 10,000 and informational item discount 2,000; coupon then acts on 10,000, not 8,000.

Refund allocations use remaining original paid quantities/discount/tax, with final-unit remainder to preserve full refund equality. Never calculate a refund from today's product tax or price.

## Concurrency and acceptance

Fresh quote is recomputed at order creation; if client-reviewed quote hash differs, return changed facts for confirmation. Catalog/coupon/settings revisions are validated within transactional order preparation using write-conflict/compare-and-swap guards where necessary; read-then-write without guards is insufficient.

Order snapshots do not change after accepted creation. Coupon claim deadline and order deadline are recorded; a held claim is honored until that deadline even if the public coupon subsequently expires, unless explicit cancellation policy applies. Late expiry recovery must reacquire coupon capacity or require refund review; never silently charge extra or exceed usage limits.

See [edge cases](../quality/EDGE-CASES.md) MONEY-01/02 and CHECK-01.

## Part 4A executable contract

Implementation: src/modules/pricing/money.ts and price.ts; [ADR 0008](../adr/0008-pure-domain-foundation.md). Money maximum is 9,007,199,254,740,990 paise, strictly below the JS safe-integer maximum, with BigInt rational intermediates. Basis points range 0–10,000; quantity is 1–99; a quote has 1–100 uniquely keyed lines. Invalid input fails explicitly. The default sale<=MRP rule has no exception enabled in this implementation.

Coupon minimum is eligible sale subtotal before coupon, after catalog discount. Dates are start-inclusive/end-exclusive. Line/component remainder ties use code-unit key order, never locale sorting. Tax requires explicit inclusive/exclusive/exempt mode; exemption includes a reason; component rates must sum to the resolved rate. Shipping gets its own tax calculation and threshold includes discounted goods tax. Version 1 has zero final rounding adjustment. Quote inputs are copied, not retained by mutable reference.

Transactionally validating these facts and original-snapshot partial refund allocations remain later integration work. Pure tests do not establish client tax/legal compliance.

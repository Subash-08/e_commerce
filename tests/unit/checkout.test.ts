import { describe, expect, it } from "vitest";
import { checkoutQuoteInput } from "../../src/modules/checkout/contracts";
const address = {
  name: "Subash",
  mobile: "9876543210",
  line1: "12 Market Road",
  line2: "",
  landmark: "",
  city: "Chennai",
  district: "Chennai",
  stateCode: "TN",
  postalCode: "600001",
  countryCode: "IN",
};
const valid = {
  contact: {
    name: "Subash",
    email: "subash@example.com",
    mobile: "9876543210",
  },
  shippingAddress: address,
  billingSameAsShipping: true,
  billingAddress: null,
  business: { legalName: "", gstin: "" },
  deliveryNote: "",
  payment: "ONLINE",
  coupon: "",
  termsAccepted: true,
  marketingConsent: false,
  guestLines: [
    {
      productId: "675000000000000000000001",
      variantId: "675000000000000000000002",
      quantity: 1,
    },
  ],
  cartRevision: 0,
};
describe("checkout quote input", () => {
  it("normalizes an India/INR checkout request without client totals", () => {
    const result = checkoutQuoteInput.parse(valid);
    expect(result.contact.email).toBe("subash@example.com");
    expect(result).not.toHaveProperty("total");
  });
  it.each([
    { ...valid, termsAccepted: false },
    { ...valid, shippingAddress: { ...address, postalCode: "000000" } },
    { ...valid, contact: { ...valid.contact, mobile: "123" } },
    { ...valid, billingSameAsShipping: false, billingAddress: null },
  ])("rejects unsafe or incomplete checkout input", (value) =>
    expect(checkoutQuoteInput.safeParse(value).success).toBe(false),
  );
});

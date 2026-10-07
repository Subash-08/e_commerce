import { describe, expect, it } from "vitest";
import {
  authorize,
  type IdentityAction,
  type ProfileAuthority,
  type SessionAuthority,
} from "../../src/modules/identity/authorization";

const session: SessionAuthority = {
  authUserId: "user-a",
  authVersion: 2,
  expiresAt: 200,
};
const profile: ProfileAuthority = {
  authUserId: "user-a",
  authVersion: 2,
  role: "ADMIN",
  status: "ACTIVE",
};
describe("Identity service authorization", () => {
  it("allows staff catalog work but rejects refunds and authority changes", () => {
    const staff = { ...profile, role: "STAFF" as const };
    expect(authorize(session, staff, "catalog.manage", { now: 100 }).role).toBe(
      "STAFF",
    );
    for (const action of ["refund.manage", "authority.manage"] as const)
      expect(() => authorize(session, staff, action, { now: 100 })).toThrow(
        "FORBIDDEN",
      );
  });
  it("denies customer administrative access", () => {
    expect(() =>
      authorize(session, { ...profile, role: "CUSTOMER" }, "catalog.manage", {
        now: 100,
      }),
    ).toThrow("FORBIDDEN");
  });
  it("requires ownership even for admin personal-record operations", () => {
    expect(() =>
      authorize(session, profile, "invoice.own", {
        now: 100,
        resourceOwnerId: "user-b",
      }),
    ).toThrow("FORBIDDEN");
    expect(() =>
      authorize(session, profile, "invoice.own", { now: 100 }),
    ).toThrow("FORBIDDEN");
    expect(
      authorize(session, profile, "invoice.own", {
        now: 100,
        resourceOwnerId: "user-a",
      }).authUserId,
    ).toBe("user-a");
  });
  it("denies absent, expired, mismatched, disabled and stale authority", () => {
    const cases: [SessionAuthority | null, ProfileAuthority | null][] = [
      [null, profile],
      [session, null],
      [{ ...session, expiresAt: 100 }, profile],
      [session, { ...profile, authUserId: "user-b" }],
      [session, { ...profile, status: "DISABLED" }],
      [session, { ...profile, authVersion: 3 }],
      [session, { ...profile, authVersion: 0 }],
    ];
    for (const [s, p] of cases)
      expect(() => authorize(s, p, "catalog.manage", { now: 100 })).toThrow(
        "AUTH_REQUIRED",
      );
  });
  it("fails closed on unknown actions rather than inherited object properties", () => {
    expect(() =>
      authorize(session, profile, "toString" as IdentityAction, { now: 100 }),
    ).toThrow("FORBIDDEN");
  });
});

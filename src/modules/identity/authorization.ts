import { DomainError } from "../../shared/domain/errors";
import {
  stateValues,
  type StateValue,
} from "../../shared/domain/states.generated";

type ProfileRole = StateValue<"Role">;
export interface SessionAuthority {
  readonly authUserId: string;
  readonly authVersion: number;
  readonly expiresAt: number;
}
export interface ProfileAuthority {
  readonly authUserId: string;
  readonly role: ProfileRole;
  readonly status: StateValue<"AccountState">;
  readonly authVersion: number;
}
const permissions: Readonly<Record<string, readonly ProfileRole[]>> = {
  "profile.own": stateValues.Role,
  "address.own": stateValues.Role,
  "order.own": stateValues.Role,
  "invoice.own": stateValues.Role,
  "catalog.manage": ["STAFF", "ADMIN"],
  "media.manage": ["STAFF", "ADMIN"],
  "content.manage": ["STAFF", "ADMIN"],
  "fulfillment.manage": ["STAFF", "ADMIN"],
  "support.read": ["STAFF", "ADMIN"],
  "payment.summary": ["STAFF", "ADMIN"],
  "refund.manage": ["ADMIN"],
  "exception.manage": ["ADMIN"],
  "coupon.manage": ["ADMIN"],
  "reports.read": ["ADMIN"],
  "settings.manage": ["ADMIN"],
  "users.manage": ["ADMIN"],
  "audit.read": ["ADMIN"],
  "authority.manage": ["ADMIN"],
};
export type IdentityAction =
  | "profile.own"
  | "address.own"
  | "order.own"
  | "invoice.own"
  | "catalog.manage"
  | "media.manage"
  | "content.manage"
  | "fulfillment.manage"
  | "support.read"
  | "payment.summary"
  | "refund.manage"
  | "exception.manage"
  | "coupon.manage"
  | "reports.read"
  | "settings.manage"
  | "users.manage"
  | "audit.read"
  | "authority.manage";

/** Inputs must come from verified library sessions and a fresh private profile read, never the browser. */
export function authorize(
  session: SessionAuthority | null,
  profile: ProfileAuthority | null,
  action: IdentityAction,
  context: { readonly now: number; readonly resourceOwnerId?: string },
): Readonly<{ authUserId: string; role: ProfileRole; authVersion: number }> {
  if (
    !session ||
    !profile ||
    !Number.isSafeInteger(context.now) ||
    context.now < 0 ||
    !Number.isSafeInteger(session.expiresAt) ||
    session.expiresAt <= context.now ||
    !session.authUserId ||
    session.authUserId !== profile.authUserId ||
    profile.status !== "ACTIVE" ||
    !stateValues.Role.includes(profile.role) ||
    !Number.isSafeInteger(profile.authVersion) ||
    profile.authVersion < 1 ||
    session.authVersion !== profile.authVersion
  )
    throw new DomainError("AUTH_REQUIRED");
  if (
    !Object.hasOwn(permissions, action) ||
    !permissions[action].includes(profile.role)
  )
    throw new DomainError("FORBIDDEN");
  if (
    action.endsWith(".own") &&
    (!context.resourceOwnerId || context.resourceOwnerId !== profile.authUserId)
  )
    throw new DomainError("FORBIDDEN");
  return Object.freeze({
    authUserId: profile.authUserId,
    role: profile.role,
    authVersion: profile.authVersion,
  });
}

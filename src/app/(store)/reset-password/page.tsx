import { AccountForm } from "@/modules/identity/account-form";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Page() {
  return <AccountForm mode="reset-password" />;
}

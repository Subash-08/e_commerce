export const dynamic = "force-dynamic";
import { requireAccountPage } from "@/modules/identity/page-guard";
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccountPage();
  return children;
}

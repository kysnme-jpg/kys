import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Dock } from "@/components/layout/dock";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-paper">
      {/* pages provide their own padding; we only reserve room for the dock */}
      <main className="pb-[124px] max-[767px]:pb-[96px]">{children}</main>
      <Dock />
    </div>
  );
}

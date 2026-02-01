import { auth } from "@/lib/auth";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const session = await auth();
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const userName = session?.user?.name?.split(" ")[0] || "Operator";

  return (
    <DashboardContent userName={userName} currentDate={currentDate} />
  );
}

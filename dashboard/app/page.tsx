import { loadDashboardData } from "@/lib/data";
import { DashboardShell } from "@/components/DashboardShell";

// Statistics come from the pipeline at request time when PIPELINE_URL is set,
// so the page must not be statically prerendered at build.
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await loadDashboardData();
  return <DashboardShell data={data} />;
}

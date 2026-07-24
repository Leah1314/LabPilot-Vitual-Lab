import { loadConfiguredPipeline, loadSampleDashboardData } from "@/lib/data";
import { Workspace } from "@/components/Workspace";

// PIPELINE_URL is read per request when set, so this must not be prerendered.
export const dynamic = "force-dynamic";

export default async function Page() {
  const sample = loadSampleDashboardData();
  const preloaded = await loadConfiguredPipeline();
  return <Workspace sample={sample} preloaded={preloaded} />;
}

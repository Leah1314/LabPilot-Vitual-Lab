import { NextResponse } from "next/server";
import { observations } from "@/lib/dose-response";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (id !== "EXP-001") return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  return NextResponse.json({ experiment: { id, name: "Palbociclib response in MCF-7 cells", compound: "Palbociclib", cell_line: "MCF-7", endpoint: "cell_viability" }, observations });
}

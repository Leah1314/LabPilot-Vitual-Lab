import { NextRequest, NextResponse } from "next/server";

const TIMEOUT_MS = 5500;

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json", ...init?.headers } });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  return response.json();
}

async function chembl(target: string) {
  const base = "https://www.ebi.ac.uk/chembl/api/data";
  const data = await fetchJson(`${base}/target/search.json?q=${encodeURIComponent(target)}&limit=5`);
  return (data.targets ?? []).map((item: Record<string, unknown>) => ({ id: item.target_chembl_id, name: item.pref_name, type: item.target_type }));
}

async function clinicalTrials(query: string) {
  const data = await fetchJson(`https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=10&format=json`);
  return (data.studies ?? []).map((study: { protocolSection?: { identificationModule?: { nctId?: string; briefTitle?: string }; designModule?: { phases?: string[] }; statusModule?: { overallStatus?: string } } }) => ({
    nctId: study.protocolSection?.identificationModule?.nctId,
    title: study.protocolSection?.identificationModule?.briefTitle,
    phase: study.protocolSection?.designModule?.phases?.join(", ") ?? "Not specified",
    status: study.protocolSection?.statusModule?.overallStatus,
  }));
}

async function openTargets(target: string) {
  const query = `query Search($query: String!) { search(queryString: $query, entityNames: [\"target\", \"disease\", \"drug\"], page: { index: 0, size: 8 }) { hits { id name entity description } } }`;
  const data = await fetchJson("https://api.platform.opentargets.org/api/v4/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables: { query: target } }) });
  return data.data?.search?.hits ?? [];
}

async function pubChem(compound: string) {
  const properties = "MolecularFormula,MolecularWeight,CanonicalSMILES,IsomericSMILES";
  const data = await fetchJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(compound)}/property/${properties}/JSON`);
  return data.PropertyTable?.Properties?.[0] ?? null;
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("target") || "KRAS G12D";
  const disease = request.nextUrl.searchParams.get("disease") || "pancreatic adenocarcinoma";
  const compound = request.nextUrl.searchParams.get("compound") || "RMC-6236";
  const model = request.nextUrl.searchParams.get("model") || "AsPC-1";
  const query = [target, disease, compound].filter(Boolean).join(" ");
  const jobs = { chembl: chembl(target), clinicalTrials: clinicalTrials(query), openTargets: openTargets(target), pubChem: pubChem(compound) };
  const entries = await Promise.all(Object.entries(jobs).map(async ([name, job]) => {
    try { return [name, { status: "ok", data: await job }] as const; }
    catch (error) { return [name, { status: "unavailable", data: null, error: error instanceof Error ? error.message : "Unknown source error" }] as const; }
  }));
  const sourceStatus = Object.fromEntries(entries.map(([name, result]) => [name, result.status]));
  return NextResponse.json({
    query: { target, disease, compound, model },
    sources: entries.map(([name, result]) => ({ name, status: result.status, data: result.data, error: "error" in result ? result.error : undefined })),
    evidence: [],
    source_status: sourceStatus,
    generated_at: new Date().toISOString(),
    note: "ClinicalTrials.gov results are contextual only and are excluded from preclinical concentration modeling.",
  });
}

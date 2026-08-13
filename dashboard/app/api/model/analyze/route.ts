import { NextResponse } from "next/server";
import { analyzeExperiment } from "@/lib/dose-response";

export async function POST() { return NextResponse.json(analyzeExperiment()); }

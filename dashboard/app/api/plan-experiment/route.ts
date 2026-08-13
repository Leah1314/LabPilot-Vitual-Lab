import { NextResponse } from "next/server";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { experiment_id?: string; dose?: number; approved?: boolean };
  if (body.experiment_id !== "EXP-001" || typeof body.dose !== "number" || body.approved !== true)
    return NextResponse.json({ error: "A valid, human-approved candidate is required" }, { status: 400 });
  const planned = { id: `PLAN-${Date.now()}`, experiment_id: body.experiment_id, dose: body.dose, unit: "nM", status: "planned", source: "LabPilot recommendation", human_approved: true, created_at: new Date().toISOString() };
  const table = process.env.AWS_DYNAMODB_TABLE;
  if (table) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-west-2" });
    await client.send(new PutItemCommand({ TableName: table, Item: {
      id: { S: planned.id }, experiment_id: { S: planned.experiment_id }, dose: { N: String(planned.dose) }, unit: { S: planned.unit }, status: { S: planned.status }, source: { S: planned.source }, human_approved: { BOOL: true }, created_at: { S: planned.created_at },
    }}));
  }
  return NextResponse.json({ planned_experiment: planned, persistence: table ? "aws_dynamodb" : "demo_session" });
}

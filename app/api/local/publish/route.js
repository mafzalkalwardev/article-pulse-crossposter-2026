import { NextResponse } from "next/server";
import { getPublishStatus, runPublishCycle } from "../../../../lib/local-publisher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPublishStatus());
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to read publish status" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const lastCycle = await runPublishCycle();
    const status = await getPublishStatus();
    return NextResponse.json({ ...status, lastCycle });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Publish cycle failed" }, { status: 500 });
  }
}

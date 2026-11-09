import { NextResponse } from "next/server";
import { z } from "zod";
import { saveConnection } from "../../../../lib/local-publisher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const connectionSchema = z.object({
  provider: z.enum(["devto", "hashnode"]),
  secret: z.string().min(1),
  publicationId: z.string().min(1).optional(),
});

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid connection payload" }, { status: 400 });
  }
  const parsed = connectionSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid connection payload" }, { status: 400 });
  try {
    return NextResponse.json(await saveConnection(parsed.data));
  } catch (error) {
    return NextResponse.json({ error: error.message || "Connection could not be verified." }, { status: 400 });
  }
}

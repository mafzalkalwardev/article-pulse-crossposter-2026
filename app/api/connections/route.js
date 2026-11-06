import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase-server";
import { encryptSecret } from "../../../lib/crypto";
import { z } from "zod";
import { verifyHashnodeConnection } from "../../../lib/publishers";

const connectionSchema = z.object({
  provider: z.enum(["github", "hashnode", "devto"]),
  secret: z.string().min(1),
  metadata: z.record(z.string()).optional(),
});

export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = connectionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid connection payload" }, { status: 400 });
  const { provider, secret, metadata = {} } = parsed.data;
  if (provider === "hashnode") {
    if (!metadata.publicationId) return NextResponse.json({ error: "Hashnode publication ID is required." }, { status: 400 });
    try {
      await verifyHashnodeConnection({ apiToken: secret, publicationId: metadata.publicationId });
    } catch (error) {
      return NextResponse.json({ error: error.message || "Hashnode connection could not be verified." }, { status: 400 });
    }
  }
  const { error } = await supabase.from("connections").upsert({
    user_id: user.id,
    provider,
    encrypted_secret: encryptSecret(secret),
    metadata,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });
  if (error) return NextResponse.json({ error: "Unable to save connection" }, { status: 500 });
  return NextResponse.json({ provider, connected: true });
}

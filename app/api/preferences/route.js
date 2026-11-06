import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase-server";
import { z } from "zod";

const preferencesSchema = z.object({
  auto_publish: z.boolean(),
  timezone: z.string().min(1).max(80),
  publish_hour: z.number().int().min(0).max(23),
  github_url: z.string().url().optional().or(z.literal("")),
  topics: z.array(z.string().min(1).max(40)).max(12),
  audience: z.string().min(1).max(120),
  tone: z.string().min(1).max(80),
  formats: z.array(z.string().min(1).max(60)).min(1).max(8),
  image_style: z.string().min(1).max(120),
  image_alt_style: z.string().min(1).max(160),
});

export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = preferencesSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid publishing preferences" }, { status: 400 });
  const { error } = await supabase.from("profiles").upsert({ id: user.id, preferences: parsed.data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Unable to save publishing preferences" }, { status: 500 });
  return NextResponse.json({ preferences: parsed.data });
}

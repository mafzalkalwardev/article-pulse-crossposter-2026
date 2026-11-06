import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase-server";
import { z } from "zod";

const articleSchema = z.object({
  title: z.string().min(10).max(140),
  description: z.string().max(180).optional(),
  body_markdown: z.string().min(100),
  tags: z.array(z.string()).min(1).max(5),
  canonical_url: z.string().url().optional().or(z.literal("")),
  source: z.record(z.any()).optional(),
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await supabase.from("articles").select("id,title,status,tags,scheduled_for,created_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load articles" }, { status: 500 });
  return NextResponse.json({ articles: data });
}

export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = articleSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid article payload" }, { status: 400 });
  const { data, error } = await supabase.from("articles").insert({ user_id: user.id, ...parsed.data }).select("id,title,status").single();
  if (error) return NextResponse.json({ error: "Unable to save article" }, { status: 500 });
  return NextResponse.json({ article: data }, { status: 201 });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: dueArticles, error } = await supabase.from("articles").select("id,user_id").eq("status", "scheduled").lte("scheduled_for", new Date().toISOString()).limit(50);
  if (error) return NextResponse.json({ error: "Unable to load scheduled articles" }, { status: 500 });
  return NextResponse.json({ due: dueArticles?.length || 0, message: "Due articles are queued for authenticated publisher execution.", ids: (dueArticles || []).map((article) => article.id) });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptSecret } from "../../../../lib/crypto";
import { publishToDevTo, publishToHashnode } from "../../../../lib/publishers";

export async function GET(request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: dueArticles, error } = await supabase.from("articles").select("*").eq("status", "scheduled").lte("scheduled_for", new Date().toISOString()).limit(50);
  if (error) return NextResponse.json({ error: "Unable to load scheduled articles" }, { status: 500 });
  const results = [];
  for (const article of dueArticles || []) {
    const { data: connections } = await supabase.from("connections").select("provider,encrypted_secret,metadata").eq("user_id", article.user_id).in("provider", ["hashnode", "devto"]);
    const byProvider = Object.fromEntries((connections || []).map((connection) => [connection.provider, connection]));
    const publishedTargets = {};
    const failures = {};
    if (byProvider.devto) {
      try { publishedTargets.devto = await publishToDevTo({ apiKey: decryptSecret(byProvider.devto.encrypted_secret), article }); } catch (publishError) { failures.devto = publishError.message; }
    } else failures.devto = "dev.to is not connected";
    if (byProvider.hashnode) {
      try { publishedTargets.hashnode = await publishToHashnode({ apiToken: decryptSecret(byProvider.hashnode.encrypted_secret), publicationId: byProvider.hashnode.metadata.publicationId, article }); } catch (publishError) { failures.hashnode = publishError.message; }
    } else failures.hashnode = "Hashnode is not connected";
    const status = Object.keys(publishedTargets).length && !Object.keys(failures).length ? "published" : "failed";
    await supabase.from("articles").update({ status, published_targets: publishedTargets }).eq("id", article.id);
    results.push({ id: article.id, status, failures });
  }
  return NextResponse.json({ due: dueArticles?.length || 0, results });
}

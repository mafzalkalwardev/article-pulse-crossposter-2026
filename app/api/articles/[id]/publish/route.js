import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase-server";
import { decryptSecret } from "../../../../../lib/crypto";
import { publishToDevTo, publishToHashnode } from "../../../../../lib/publishers";

export async function POST(request, { params }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: article, error: articleError } = await supabase.from("articles").select("*").eq("id", params.id).single();
  if (articleError || !article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  if (article.status === "published") return NextResponse.json({ error: "Article already published", published_targets: article.published_targets }, { status: 409 });
  const { data: connections, error: connectionError } = await supabase.from("connections").select("provider,encrypted_secret,metadata").in("provider", ["hashnode", "devto"]);
  if (connectionError) return NextResponse.json({ error: "Unable to load publishing connections" }, { status: 500 });
  const byProvider = Object.fromEntries(connections.map((connection) => [connection.provider, connection]));
  const results = {};
  const failures = {};
  await supabase.from("articles").update({ status: "publishing" }).eq("id", article.id);
  if (byProvider.devto) {
    try { results.devto = await publishToDevTo({ apiKey: decryptSecret(byProvider.devto.encrypted_secret), article }); } catch (error) { failures.devto = error.message; }
  } else failures.devto = "dev.to is not connected";
  if (byProvider.hashnode) {
    try { results.hashnode = await publishToHashnode({ apiToken: decryptSecret(byProvider.hashnode.encrypted_secret), publicationId: byProvider.hashnode.metadata.publicationId, article }); } catch (error) { failures.hashnode = error.message; }
  } else failures.hashnode = "Hashnode is not connected";
  const status = Object.keys(results).length && !Object.keys(failures).length ? "published" : "failed";
  await supabase.from("articles").update({ status, published_targets: results }).eq("id", article.id);
  return NextResponse.json({ status, results, failures }, { status: status === "published" ? 200 : 502 });
}

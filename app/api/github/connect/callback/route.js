import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase-server";
import { encryptSecret } from "../../../../../lib/crypto";

export async function GET(request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/dashboard?error=github_denied", request.url));
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
  });
  const token = await tokenResponse.json();
  if (!token.access_token) return NextResponse.redirect(new URL("/dashboard?error=github_connection_failed", request.url));
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  await supabase.from("connections").upsert({ user_id: user.id, provider: "github", encrypted_secret: encryptSecret(token.access_token), metadata: {}, updated_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
  return NextResponse.redirect(new URL("/dashboard?connected=github", request.url));
}

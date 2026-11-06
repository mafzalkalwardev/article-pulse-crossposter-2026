import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import { syncGitHubProfile, suggestArticles } from "../../../../lib/profile";
import { z } from "zod";

const bodySchema = z.object({ github_url: z.string().url().optional() }).optional();

export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid GitHub link" }, { status: 400 });
  const githubUrl = body.data?.github_url;
  const username = githubUrl ? new URL(githubUrl).pathname.split("/").filter(Boolean)[0] : undefined;
  if (githubUrl && (new URL(githubUrl).hostname !== "github.com" || !username)) {
    return NextResponse.json({ error: "Provide a valid github.com profile URL" }, { status: 400 });
  }
  const { data: existingProfile } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
  const result = await syncGitHubProfile(undefined, username);
  const suggestions = suggestArticles(result, existingProfile?.preferences || {});
  await supabase.from("profiles").upsert({ id: user.id, username: user.email?.split("@")[0], display_name: result.profile.name, bio: result.profile.bio, github_login: result.profile.login, github_data: result, updated_at: new Date().toISOString() });
  return NextResponse.json({ profile: result.profile, suggestions });
}

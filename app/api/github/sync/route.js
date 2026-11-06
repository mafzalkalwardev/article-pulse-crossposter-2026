import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import { syncGitHubProfile, suggestArticles } from "../../../../lib/profile";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const result = await syncGitHubProfile();
  const suggestions = suggestArticles(result);
  await supabase.from("profiles").upsert({ id: user.id, username: user.email?.split("@")[0], display_name: result.profile.name, bio: result.profile.bio, github_login: result.profile.login, github_data: result });
  return NextResponse.json({ profile: result.profile, suggestions });
}

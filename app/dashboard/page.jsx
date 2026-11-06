import { createSupabaseServerClient } from "../../lib/supabase-server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const demoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let user = { email: "demo@articlepulse.local" };
  let profile = null;
  if (!demoMode) {
    const supabase = createSupabaseServerClient();
    const authResult = await supabase.auth.getUser();
    user = authResult.data.user;
    if (!user) redirect("/login");
    const profileResult = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    profile = profileResult.data;
  }
  return <main className="dashboard"><nav><a className="brand" href="/">⌁ Article Pulse</a><span>{demoMode ? "Local demo workspace" : user.email}</span></nav>{demoMode && <div className="demo-banner"><strong>Demo mode</strong><span>Data is local to this test session. Configure Supabase later to enable real accounts and publishing.</span></div>}<section className="dashboard-hero"><p className="eyebrow">Your workspace</p><h1>Turn your work into momentum.</h1><p>Sync GitHub to load your project context, then choose an article suggestion to draft and schedule.</p></section><DashboardClient demoMode={demoMode} initialProfile={profile?.github_data?.profile ? { profile: profile.github_data.profile, suggestions: [] } : null} /></main>;
}

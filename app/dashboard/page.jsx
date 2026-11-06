import { createSupabaseServerClient } from "../../lib/supabase-server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return <main className="dashboard"><nav><a className="brand" href="/">⌁ Article Pulse</a><span>{user.email}</span></nav><section className="dashboard-hero"><p className="eyebrow">Your workspace</p><h1>Turn your work into momentum.</h1><p>Sync GitHub to load your project context, then choose an article suggestion to draft and schedule.</p></section><DashboardClient initialProfile={profile?.github_data?.profile ? { profile: profile.github_data.profile, suggestions: [] } : null} /></main>;
}

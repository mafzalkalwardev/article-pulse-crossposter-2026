import { createSupabaseServerClient } from "../lib/supabase-server";
import Link from "next/link";

export default async function HomePage() {
  let user = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createSupabaseServerClient();
    user = (await supabase.auth.getUser()).data.user;
  }
  return (
    <main className="landing">
      <nav><Link className="brand" href="/"><span>⌁</span> Article Pulse</Link><Link className="nav-link" href={user ? "/dashboard" : "/login"}>{user ? "Open dashboard" : "Create your account →"}</Link></nav>
      <section className="landing-hero">
        <p className="eyebrow">Your public work, understood</p>
        <h1>Build a presence that keeps working after you close the editor.</h1>
        <p className="lead">Connect GitHub, turn real project evidence into useful article ideas, optimize every post for search, and publish to Hashnode and dev.to from one personal workspace.</p>
        <Link className="primary-button" href={user ? "/dashboard" : "/login"}>{user ? "Open your workspace" : "Start your workspace"} <span>↗</span></Link>
      </section>
      <section className="feature-grid"><article><b>01</b><h2>Know your work</h2><p>Sync your public GitHub profile, repositories, languages, topics, and project evidence.</p></article><article><b>02</b><h2>Find your angle</h2><p>Get grounded article suggestions with critical questions, problems, solutions, and searchable tags.</p></article><article><b>03</b><h2>Publish everywhere</h2><p>Connect publishing accounts, schedule posts, and track each platform result without duplicate publishing.</p></article></section>
    </main>
  );
}

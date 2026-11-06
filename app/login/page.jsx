"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const submit = async (event) => {
    event.preventDefault();
    if (!supabaseConfigured) {
      setMessage("Supabase is not configured. Copy .env.local.example to .env.local, add your Supabase URL and anon key, then restart Next.js.");
      return;
    }
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      setMessage(error ? error.message : "Check your email for a secure sign-in link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start sign-in.");
    }
  };
  return <main className="auth-page"><div className="auth-card"><a className="brand" href="/">⌁ Article Pulse</a><h1>Your work deserves a home.</h1><p>Sign in with a magic link. No password to store.</p>{!supabaseConfigured && <div className="setup-notice"><strong>Setup required</strong><span>Authentication is disabled until Supabase environment variables are configured.</span></div>}<form onSubmit={submit}><input required type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button className="primary-button" type="submit">Send sign-in link →</button></form>{message && <small>{message}</small>}</div></main>;
}

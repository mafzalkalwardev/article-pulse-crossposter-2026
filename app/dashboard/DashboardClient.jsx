"use client";

import { useState } from "react";

export default function DashboardClient({ initialProfile, demoMode = false }) {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState("devto");
  const [secret, setSecret] = useState("");
  const [publicationId, setPublicationId] = useState("");

  async function sync() {
    setMessage("Syncing public GitHub work…");
    if (demoMode) {
      setProfile({
        profile: { name: "Demo Publisher", login: "demo-user", public_repos: 12 },
        suggestions: [
          { title: "A practical system for turning project work into useful articles", problem: "How can engineering work become consistent, searchable documentation?", solution: "Capture one concrete problem per article, link public evidence, and reuse a reviewable publishing pipeline.", evidence: ["demo/article-pulse", "demo/automation-lab"], tags: ["content-strategy", "developer-experience", "seo"] },
          { title: "Critical questions for reliable automation systems", problem: "What fails when an automation grows beyond its first successful run?", solution: "Add idempotency, observable outcomes, explicit credentials, and a human review boundary.", evidence: ["demo/automation-lab"], tags: ["automation", "reliability", "software-engineering"] },
          { title: "What I learned building a publishing workflow", problem: "Which recurring constraint costs the most time in content operations?", solution: "Document the decision, trade-offs, implementation, and measurable result.", evidence: ["demo/article-pulse"], tags: ["publishing", "developer-tools", "productivity"] },
        ],
      });
      setMessage("Demo profile loaded with 3 sample article suggestions.");
      return;
    }
    const response = await fetch("/api/github/sync", { method: "POST" });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error || "GitHub sync failed");
    setProfile(result);
    setMessage(`${result.suggestions.length} evidence-based article suggestions ready.`);
  }

  async function connect(event) {
    event.preventDefault();
    if (demoMode) {
      setMessage("Demo mode does not store credentials. Configure Supabase to test real connections.");
      return;
    }
    const response = await fetch("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, secret, metadata: provider === "hashnode" ? { publicationId } : {} }) });
    const result = await response.json();
    setMessage(response.ok ? `${provider} connected securely.` : result.error || "Connection failed");
    if (response.ok) setSecret("");
  }

  async function saveSuggestion(suggestion) {
    if (demoMode) {
      setMessage("Demo draft saved locally for this browser session.");
      return;
    }
    const body = `# ${suggestion.title}\n\n## The question\n\n${suggestion.problem}\n\n## The solution\n\n${suggestion.solution}\n\n## Public evidence\n\n${suggestion.evidence.map((item) => `- ${item}`).join("\n")}`;
    const response = await fetch("/api/articles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: suggestion.title, body_markdown: body, tags: suggestion.tags, source: { evidence: suggestion.evidence } }) });
    setMessage(response.ok ? "Draft saved. Review it before publishing." : "Could not save draft.");
  }

  return <div className="dashboard-body">
    <div className="dashboard-actions"><button className="primary-button" onClick={sync}>Sync GitHub and suggest articles →</button><span>{message}</span></div>
    <div className="dashboard-grid">
      <section className="work-card"><h2>Account connections</h2><p className="muted">{demoMode ? "Demo mode keeps credentials disabled. You can test the connection UI without storing secrets." : "Secrets are encrypted before storage and are never sent back to this page."}</p><form onSubmit={connect}><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="devto">dev.to API key</option><option value="hashnode">Hashnode API token</option></select><input required type="password" placeholder="Credential" value={secret} onChange={(event) => setSecret(event.target.value)} />{provider === "hashnode" && <input required placeholder="Hashnode publication ID" value={publicationId} onChange={(event) => setPublicationId(event.target.value)} />}<button type="submit">Connect securely</button></form></section>
      <section className="work-card"><h2>Profile signals</h2>{profile ? <><p><b>{profile.profile?.name}</b> · @{profile.profile?.login}</p><p className="muted">{profile.profile?.public_repos || 0} public repositories · languages and topics used as evidence</p></> : <p className="muted">Sync GitHub to load your public work.</p>}</section>
    </div>
    {profile?.suggestions?.length ? <section className="suggestions"><h2>Suggested articles</h2><div className="suggestion-grid">{profile.suggestions.map((suggestion) => <article className="suggestion" key={suggestion.title}><p className="eyebrow">Evidence-based idea</p><h3>{suggestion.title}</h3><p><b>Question:</b> {suggestion.problem}</p><p><b>Solution:</b> {suggestion.solution}</p><div className="tag-row">{suggestion.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><button onClick={() => saveSuggestion(suggestion)}>Save as draft</button></article>)}</div></section> : null}
  </div>;
}

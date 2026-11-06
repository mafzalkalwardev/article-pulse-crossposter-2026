"use client";

import { useState } from "react";

export default function DashboardClient({ initialProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState("devto");
  const [secret, setSecret] = useState("");
  const [publicationId, setPublicationId] = useState("");

  async function sync() {
    setMessage("Syncing public GitHub work…");
    const response = await fetch("/api/github/sync", { method: "POST" });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error || "GitHub sync failed");
    setProfile(result);
    setMessage(`${result.suggestions.length} evidence-based article suggestions ready.`);
  }

  async function connect(event) {
    event.preventDefault();
    const response = await fetch("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, secret, metadata: provider === "hashnode" ? { publicationId } : {} }) });
    const result = await response.json();
    setMessage(response.ok ? `${provider} connected securely.` : result.error || "Connection failed");
    if (response.ok) setSecret("");
  }

  async function saveSuggestion(suggestion) {
    const body = `# ${suggestion.title}\n\n## The question\n\n${suggestion.problem}\n\n## The solution\n\n${suggestion.solution}\n\n## Public evidence\n\n${suggestion.evidence.map((item) => `- ${item}`).join("\n")}`;
    const response = await fetch("/api/articles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: suggestion.title, body_markdown: body, tags: suggestion.tags, source: { evidence: suggestion.evidence } }) });
    setMessage(response.ok ? "Draft saved. Review it before publishing." : "Could not save draft.");
  }

  return <div className="dashboard-body">
    <div className="dashboard-actions"><button className="primary-button" onClick={sync}>Sync GitHub and suggest articles →</button><span>{message}</span></div>
    <div className="dashboard-grid">
      <section className="work-card"><h2>Account connections</h2><p className="muted">Secrets are encrypted before storage and are never sent back to this page.</p><form onSubmit={connect}><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="devto">dev.to API key</option><option value="hashnode">Hashnode API token</option></select><input required type="password" placeholder="Credential" value={secret} onChange={(event) => setSecret(event.target.value)} />{provider === "hashnode" && <input required placeholder="Hashnode publication ID" value={publicationId} onChange={(event) => setPublicationId(event.target.value)} />}<button type="submit">Connect securely</button></form></section>
      <section className="work-card"><h2>Profile signals</h2>{profile ? <><p><b>{profile.profile?.name}</b> · @{profile.profile?.login}</p><p className="muted">{profile.profile?.public_repos || 0} public repositories · languages and topics used as evidence</p></> : <p className="muted">Sync GitHub to load your public work.</p>}</section>
    </div>
    {profile?.suggestions?.length ? <section className="suggestions"><h2>Suggested articles</h2><div className="suggestion-grid">{profile.suggestions.map((suggestion) => <article className="suggestion" key={suggestion.title}><p className="eyebrow">Evidence-based idea</p><h3>{suggestion.title}</h3><p><b>Question:</b> {suggestion.problem}</p><p><b>Solution:</b> {suggestion.solution}</p><div className="tag-row">{suggestion.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><button onClick={() => saveSuggestion(suggestion)}>Save as draft</button></article>)}</div></section> : null}
  </div>;
}

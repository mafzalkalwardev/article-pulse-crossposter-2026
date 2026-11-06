"use client";

import { useEffect, useState } from "react";

export default function DashboardClient({ initialProfile, demoMode = false }) {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState("devto");
  const [secret, setSecret] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [connected, setConnected] = useState({});
  const [autoPublish, setAutoPublish] = useState(false);
  const [publishHour, setPublishHour] = useState(18);
  useEffect(() => {
    if (demoMode) {
      setConnected(JSON.parse(window.localStorage.getItem("article-pulse-connections") || "{}"));
      const saved = JSON.parse(window.localStorage.getItem("article-pulse-preferences") || "{}");
      setAutoPublish(Boolean(saved.auto_publish));
      if (saved.publish_hour !== undefined) setPublishHour(saved.publish_hour);
    }
  }, [demoMode]);

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
      const next = { ...connected, [provider]: true };
      setConnected(next);
      window.localStorage.setItem("article-pulse-connections", JSON.stringify(next));
      setMessage(`${provider} demo account connected. No credentials were stored.`);
      return;
    }
    const response = await fetch("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, secret, metadata: provider === "hashnode" ? { publicationId } : {} }) });
    const result = await response.json();
    setMessage(response.ok ? `${provider} connected securely.` : result.error || "Connection failed");
    if (response.ok) setSecret("");
  }

  async function connectGitHub() {
    if (demoMode) {
      const next = { ...connected, github: true };
      setConnected(next);
      window.localStorage.setItem("article-pulse-connections", JSON.stringify(next));
      setMessage("GitHub demo account connected.");
      return;
    }
    window.location.href = "/api/github/connect";
  }

  async function savePreferences(event) {
    event.preventDefault();
    if (demoMode) {
      window.localStorage.setItem("article-pulse-preferences", JSON.stringify({ auto_publish: autoPublish, publish_hour: publishHour }));
      setMessage(autoPublish ? `Automatic publishing enabled for ${publishHour}:00 in demo mode.` : "Automatic publishing disabled.");
      return;
    }
    const response = await fetch("/api/preferences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ auto_publish: autoPublish, publish_hour: Number(publishHour), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    const result = await response.json();
    setMessage(response.ok ? "Automatic publishing preferences saved." : result.error || "Could not save preferences.");
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
      <section className="work-card"><h2>Account connections</h2><p className="muted">{demoMode ? "Demo mode simulates connections without storing credentials." : "Secrets are encrypted before storage and are never sent back to this page."}</p><div className="connection-list"><div><span>GitHub</span><b className={connected.github ? "connected" : "not-connected"}>{connected.github ? "Connected" : "Not connected"}</b><button type="button" onClick={connectGitHub}>{connected.github ? "Connected" : "Connect GitHub"}</button></div><div><span>dev.to</span><b className={connected.devto ? "connected" : "not-connected"}>{connected.devto ? "Connected" : "Not connected"}</b></div><div><span>Hashnode</span><b className={connected.hashnode ? "connected" : "not-connected"}>{connected.hashnode ? "Connected" : "Not connected"}</b></div></div><form onSubmit={connect}><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="devto">dev.to API key</option><option value="hashnode">Hashnode API token</option></select><input required type="password" placeholder="Credential" value={secret} onChange={(event) => setSecret(event.target.value)} />{provider === "hashnode" && <input required placeholder="Hashnode publication ID" value={publicationId} onChange={(event) => setPublicationId(event.target.value)} />}<button type="submit">Connect securely</button></form></section>
      <section className="work-card"><h2>Automatic publishing</h2><p className="muted">Scheduled articles publish through every connected provider. Unconnected platforms are reported as failures.</p><form onSubmit={savePreferences}><label className="toggle-row"><input type="checkbox" checked={autoPublish} onChange={(event) => setAutoPublish(event.target.checked)} /><span>Enable automatic publishing</span></label><label className="field-label">Daily publish hour<select value={publishHour} onChange={(event) => setPublishHour(event.target.value)}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label><button type="submit">Save publishing schedule</button></form></section>
      <section className="work-card"><h2>Profile signals</h2>{profile ? <><p><b>{profile.profile?.name}</b> · @{profile.profile?.login}</p><p className="muted">{profile.profile?.public_repos || 0} public repositories · languages and topics used as evidence</p></> : <p className="muted">Sync GitHub to load your public work.</p>}</section>
    </div>
    {profile?.suggestions?.length ? <section className="suggestions"><h2>Suggested articles</h2><div className="suggestion-grid">{profile.suggestions.map((suggestion) => <article className="suggestion" key={suggestion.title}><p className="eyebrow">Evidence-based idea</p><h3>{suggestion.title}</h3><p><b>Question:</b> {suggestion.problem}</p><p><b>Solution:</b> {suggestion.solution}</p><div className="tag-row">{suggestion.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><button onClick={() => saveSuggestion(suggestion)}>Save as draft</button></article>)}</div></section> : null}
  </div>;
}

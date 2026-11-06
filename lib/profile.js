export async function syncGitHubProfile(accessToken) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "article-pulse" };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  const [profileResponse, repositoriesResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers, cache: "no-store" }),
    fetch("https://api.github.com/user/repos?sort=updated&per_page=50", { headers, cache: "no-store" }),
  ]);
  if (!profileResponse.ok || !repositoriesResponse.ok) throw new Error("GitHub profile sync failed");
  const profile = await profileResponse.json();
  const repositories = await repositoriesResponse.json();
  const languages = [...new Set(repositories.map((repo) => repo.language).filter(Boolean))].slice(0, 12);
  const topics = [...new Set(repositories.flatMap((repo) => repo.topics || []))].slice(0, 30);
  return { profile, repositories, languages, topics };
}

export function suggestArticles({ profile, repositories, languages, topics }) {
  const focus = topics[0] || languages[0] || "developer automation";
  const projects = repositories.filter((repo) => !repo.fork && repo.description).slice(0, 5);
  return [
    {
      title: `What I learned building with ${focus}`,
      problem: `Which recurring constraint appears across my ${focus} work?`,
      solution: "Document the decision, trade-offs, implementation, and measurable result.",
      evidence: projects.map((project) => project.full_name),
      tags: [focus, "automation", "developer-tools"],
    },
    {
      title: "A practical system for turning project work into useful articles",
      problem: "How can engineering work become consistent, searchable documentation?",
      solution: "Capture one concrete problem per article, link public evidence, and reuse a reviewable publishing pipeline.",
      evidence: projects.map((project) => project.full_name),
      tags: ["content-strategy", "developer-experience", "seo"],
    },
    {
      title: `Critical questions for reliable ${focus} systems`,
      problem: "What fails when an automation grows beyond its first successful run?",
      solution: "Add idempotency, observable outcomes, explicit credentials, and a human review boundary.",
      evidence: projects.map((project) => project.full_name),
      tags: [focus, "reliability", "software-engineering"],
    },
  ];
}

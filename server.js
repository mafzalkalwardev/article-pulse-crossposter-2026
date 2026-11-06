import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const articlesDir = join(root, "articles");
const assetsDir = join(root, "assets", "generated");
const port = Number(process.env.PORT || 4173);
const githubUsername = process.env.GITHUB_USERNAME || "mafzalkalwardev";
const growthAutoPublish = process.env.GROWTH_AUTO_PUBLISH === "true";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": mimeTypes[".json"] });
  response.end(JSON.stringify(payload));
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;",
  })[character]);
}

async function fetchGitHubProfile() {
  const headers = { accept: "application/vnd.github+json", "user-agent": "article-pulse-crossposter" };
  const [profileResponse, repositoriesResponse] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(githubUsername)}`, { headers }),
    fetch(`https://api.github.com/users/${encodeURIComponent(githubUsername)}/repos?sort=updated&per_page=30`, { headers }),
  ]);
  if (!profileResponse.ok || !repositoriesResponse.ok) {
    throw new Error("GitHub public profile data could not be loaded");
  }
  const profile = await profileResponse.json();
  const repositories = await repositoriesResponse.json();
  return { profile, repositories };
}

function buildGrowthArticle({ profile, repositories }) {
  const languages = [...new Set(repositories.map((repo) => repo.language).filter(Boolean))].slice(0, 4);
  const topics = [...new Set(repositories.flatMap((repo) => repo.topics || []))].slice(0, 6);
  const projects = repositories.filter((repo) => !repo.fork && (repo.stargazers_count > 0 || repo.description)).slice(0, 3);
  const focus = topics[0] || languages[0] || "developer automation";
  const title = `How I approach ${focus}: questions, problems, and practical solutions`;
  const description = `A field guide from ${profile.name || profile.login} on using ${focus} to build useful, repeatable systems.`;
  const tags = [...new Set([focus, "automation", "developer-tools", "software-engineering", "productivity"])].slice(0, 5);
  const projectLines = projects.length
    ? projects.map((repo) => `- **${repo.name}** — ${repo.description || "A public project in this workflow."}`).join("\n")
    : "- Public projects are still being organized into a repeatable publishing workflow.";
  const questions = [
    `What recurring ${focus} problem costs the most time?`,
    "Which part of the workflow should be observable and repeatable?",
    "How can the solution stay useful without hiding its assumptions?",
  ];
  const article = `---
title: "${title}"
description: "${description}"
tags: [${tags.map((tag) => `"${tag}"`).join(", ")}]
canonical_url: ""
cover_image: "/assets/generated/${slugify(title)}.svg"
publish: ${growthAutoPublish}
---

# ${title}

This is a locally generated field note based on public GitHub work by **${profile.name || profile.login}**${profile.company ? ` at ${profile.company}` : ""}. It does not invent private context or claim experiences that are not represented by the public profile and repositories.

## The critical questions

${questions.map((question) => `1. ${question}`).join("\n")}

## The problem

When a workflow grows across projects, the hard part is not producing more output. The hard part is keeping the output useful, attributable, and easy to improve. A practical system needs a source of evidence, a clear quality boundary, and a way to avoid repeating the same work.

## The solution I can provide

I can turn public project signals into a transparent publishing queue: identify a concrete topic, explain the problem, document the solution, generate a local visual, score the article for search fundamentals, and keep publication state idempotent.

## Evidence from the public profile

${projectLines}

${languages.length ? `\nThe current public repository mix includes: ${languages.join(", ")}.` : ""}

## A repeatable checklist

- Start with a specific problem rather than a generic announcement.
- Show the constraint, the decision, and the measurable outcome.
- Link to public evidence when it exists.
- Use one canonical URL and focused tags.
- Generate a cover image that summarizes the idea without copying third-party assets.
- Keep the article in draft state until the facts and links are reviewed.

## Closing

Presence compounds when every post teaches something concrete. This workflow is designed to make that process consistent while keeping the source, generation logic, and publishing boundaries visible.
`;
  return { title, description, tags, article, slug: slugify(title), profile: {
    login: profile.login,
    name: profile.name,
    company: profile.company,
    bio: profile.bio,
    publicRepos: profile.public_repos,
    followers: profile.followers,
    languages,
    topics,
    projects: projects.map((repo) => repo.name),
  } };
}

function buildCoverSvg({ title, focus }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">Locally generated Article Pulse cover for ${escapeXml(focus)}.</desc>
  <defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#293b62"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1010" cy="145" r="180" fill="#ff6b5f" opacity=".16"/><circle cx="1035" cy="130" r="92" fill="none" stroke="#ffb38b" stroke-width="2" opacity=".8"/>
  <path d="M92 470h160l46-122 71 202 54-142h148" fill="none" stroke="#ff6b5f" stroke-linecap="round" stroke-linejoin="round" stroke-width="18"/>
  <text x="92" y="115" fill="#ffb38b" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="5">ARTICLE PULSE / INDEPENDENT GROWTH</text>
  <text x="92" y="275" fill="#fff" font-family="Arial,sans-serif" font-size="54" font-weight="700">${escapeXml(title.slice(0, 42))}</text>
  <text x="92" y="338" fill="#dbe4f3" font-family="Arial,sans-serif" font-size="28">${escapeXml(title.slice(42, 84))}</text>
  <text x="92" y="558" fill="#b7c4d8" font-family="Arial,sans-serif" font-size="22">Generated locally from public GitHub signals • no AI services</text>
</svg>`;
}

async function generateGrowthDraft() {
  const source = await fetchGitHubProfile();
  const generated = buildGrowthArticle(source);
  await mkdir(assetsDir, { recursive: true });
  await writeFile(join(assetsDir, `${generated.slug}.svg`), buildCoverSvg({
    title: generated.title,
    focus: generated.tags[0],
  }), "utf8");
  const filename = `${generated.slug}.md`;
  await writeFile(join(articlesDir, filename), generated.article, "utf8");
  return { filename, image: `/assets/generated/${generated.slug}.svg`, ...generated };
}

async function listArticles() {
  const entries = await readdir(articlesDir, { withFileTypes: true });
  const markdownFiles = entries.filter(
    (entry) => entry.isFile() && [".md", ".markdown"].includes(extname(entry.name)),
  );

  return Promise.all(
    markdownFiles.map(async (entry) => {
      const source = await readFile(join(articlesDir, entry.name), "utf8");
      const title = source.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || entry.name;
      const tags = source.match(/^tags:\s*\[([^\]]*)\]/m)?.[1]
        ?.split(",")
        .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean) || [];
      return {
        file: entry.name,
        title,
        tags,
        status: source.includes("publish: true") ? "Ready" : "Draft",
      };
    }),
  );
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/health") {
    return sendJson(response, 200, { ok: true, service: "article-pulse-api" });
  }

  if (url.pathname === "/api/articles") {
    try {
      return sendJson(response, 200, { articles: await listArticles() });
    } catch (error) {
      return sendJson(response, 500, { error: "Unable to read articles", detail: error.message });
    }
  }

  if (url.pathname === "/api/growth/profile") {
    try {
      const source = await fetchGitHubProfile();
      const generated = buildGrowthArticle(source);
      return sendJson(response, 200, { mode: "independent", profile: generated.profile, seo: {
        titleLength: generated.title.length,
        descriptionLength: generated.description.length,
        tags: generated.tags,
      } });
    } catch (error) {
      return sendJson(response, 502, { error: "Unable to load public GitHub profile", detail: error.message });
    }
  }

  if (url.pathname === "/api/growth/generate" && request.method === "POST") {
    try {
      return sendJson(response, 201, await generateGrowthDraft());
    } catch (error) {
      return sendJson(response, 502, { error: "Unable to generate a local growth draft", detail: error.message });
    }
  }

  const requestedPath = normalize(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = join(publicDir, requestedPath);
  if (!filePath.startsWith(publicDir)) {
    return sendJson(response, 403, { error: "Forbidden" });
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

createServer((request, response) => {
  handle(request, response).catch((error) => {
    sendJson(response, 500, { error: "Unexpected server error", detail: error.message });
  });
}).listen(port, () => {
  console.log(`Article Pulse Crossposter running at http://localhost:${port}`);
});

import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { generateSuggestions } from "../../../../lib/intelligence";
import { researchMarket } from "../../../../lib/market-research";
import { assertIndependentEndpoint, boundedList, INDEPENDENT_MODE } from "../../../../lib/independent-mode";

const requestSchema = z.object({
  github_url: z.string().url(),
  intelligence_mode: z.enum(["deterministic", "ai"]).default("deterministic"),
  preferences: z.record(z.string(), z.any()).default({}),
});

const dataDirectory = join(process.cwd(), "data");
const requestTimes = [];
const maxRequestsPerMinute = 6;

function enforceDemoLimit() {
  const now = Date.now();
  while (requestTimes[0] && requestTimes[0] < now - 60_000) requestTimes.shift();
  if (requestTimes.length >= maxRequestsPerMinute) {
    throw new Error("Demo GitHub sync limit reached. Wait one minute before trying again.");
  }
  requestTimes.push(now);
}

export async function POST(request) {
  try {
    enforceDemoLimit();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid GitHub profile URL." }, { status: 400 });

  const githubUrl = new URL(parsed.data.github_url);
  const username = githubUrl.pathname.split("/").filter(Boolean)[0];
  if (githubUrl.hostname !== "github.com" || !username) {
    return NextResponse.json({ error: "Use a public github.com profile URL, such as https://github.com/your-name." }, { status: 400 });
  }

  const headers = { accept: "application/vnd.github+json", "user-agent": "article-pulse-demo" };
  const profileEndpoint = assertIndependentEndpoint(`https://api.github.com/users/${encodeURIComponent(username)}`);
  const repositoriesEndpoint = assertIndependentEndpoint(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=${INDEPENDENT_MODE.maxRepositoriesPerSync}`);
  const [profileResponse, repositoriesResponse] = await Promise.all([
    fetch(profileEndpoint, { headers, cache: "no-store" }),
    fetch(repositoriesEndpoint, { headers, cache: "no-store" }),
  ]);
  if (!profileResponse.ok || !repositoriesResponse.ok) {
    return NextResponse.json({ error: "GitHub profile could not be loaded. Check that the profile is public." }, { status: 502 });
  }

  const profile = await profileResponse.json();
  const repositories = boundedList(await repositoriesResponse.json(), INDEPENDENT_MODE.maxRepositoriesPerSync);
  const languages = [...new Set(repositories.map((repo) => repo.language).filter(Boolean))].slice(0, 12);
  const topics = [...new Set(repositories.flatMap((repo) => repo.topics || []))].slice(0, 30);
  const result = {
    profile: {
      login: profile.login,
      name: profile.name,
      avatar_url: profile.avatar_url,
      html_url: profile.html_url,
      bio: profile.bio,
      company: profile.company,
      blog: profile.blog,
      location: profile.location,
      public_repos: profile.public_repos,
      followers: profile.followers,
      following: profile.following,
    },
    repositories: repositories.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      language: repo.language,
      topics: repo.topics || [],
      stargazers_count: repo.stargazers_count,
      updated_at: repo.updated_at,
      fork: repo.fork,
    })),
    languages,
    topics,
    connected_at: new Date().toISOString(),
  };
  try {
    result.suggestions = boundedList(
      await generateSuggestions(result, parsed.data.preferences, parsed.data.intelligence_mode),
      INDEPENDENT_MODE.maxSuggestionsPerSync,
    );
    result.intelligence_mode = parsed.data.intelligence_mode;
    result.suggestions = await researchMarket(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  await mkdir(dataDirectory, { recursive: true });
  await writeFile(join(dataDirectory, "demo-profile.json"), JSON.stringify(result, null, 2), "utf8");
  return NextResponse.json(result);
}

export async function GET() {
  try {
    const stored = JSON.parse(await readFile(join(dataDirectory, "demo-profile.json"), "utf8"));
    return NextResponse.json(stored);
  } catch {
    return NextResponse.json({ profile: null, repositories: [], suggestions: [] });
  }
}

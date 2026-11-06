import { boundedList, INDEPENDENT_MODE } from "./independent-mode";
import { suggestArticles } from "./profile";

const aiEndpoint = process.env.INTELLIGENCE_PROVIDER_URL;
const aiKey = process.env.INTELLIGENCE_API_KEY;
const aiModel = process.env.INTELLIGENCE_MODEL || "default";

export function getIntelligenceStatus() {
  return {
    mode: aiEndpoint && aiKey ? "available" : "deterministic-only",
    providerConfigured: Boolean(aiEndpoint && aiKey),
    model: aiEndpoint && aiKey ? aiModel : null,
  };
}

function buildPrompt(profileData, preferences) {
  return `Create exactly 3 article suggestions from this public developer profile data.
Return JSON only as an array of objects with title, problem, solution, evidence, and tags.
Do not invent evidence. Evidence must use only repository full_name values supplied below.
Preferences: ${JSON.stringify(preferences)}
Profile data: ${JSON.stringify({
    profile: profileData.profile,
    languages: profileData.languages,
    topics: profileData.topics,
    repositories: profileData.repositories.slice(0, 20).map((repo) => ({
      full_name: repo.full_name,
      description: repo.description,
      language: repo.language,
      topics: repo.topics,
    })),
  })}`;
}

function validateSuggestions(value, evidence) {
  if (!Array.isArray(value)) throw new Error("Intelligence provider returned an invalid suggestion list.");
  const allowedEvidence = new Set(evidence.map((repo) => repo.full_name));
  return boundedList(value, INDEPENDENT_MODE.maxSuggestionsPerSync).map((item) => {
    if (!item || typeof item !== "object" || typeof item.title !== "string" || typeof item.problem !== "string" || typeof item.solution !== "string") {
      throw new Error("Intelligence provider returned an invalid suggestion.");
    }
    const tags = Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string").slice(0, 8) : [];
    const references = Array.isArray(item.evidence) ? item.evidence.filter((name) => allowedEvidence.has(name)).slice(0, 5) : [];
    return { title: item.title.slice(0, 140), problem: item.problem.slice(0, 500), solution: item.solution.slice(0, 800), evidence: references, tags };
  });
}

async function suggestWithProvider(profileData, preferences) {
  if (!aiEndpoint || !aiKey) throw new Error("AI intelligence is not configured. Set INTELLIGENCE_PROVIDER_URL and INTELLIGENCE_API_KEY, or use deterministic mode.");
  const response = await fetch(aiEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${aiKey}` },
    body: JSON.stringify({
      model: aiModel,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You generate concise, evidence-grounded developer article ideas." },
        { role: "user", content: buildPrompt(profileData, preferences) },
      ],
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Intelligence provider failed with HTTP ${response.status}.`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Intelligence provider returned no text.");
  const json = JSON.parse(content.replace(/^```json\s*/i, "").replace(/\s*```$/, ""));
  return validateSuggestions(json, profileData.repositories);
}

export async function generateSuggestions(profileData, preferences = {}, mode = "deterministic") {
  if (mode === "ai") return suggestWithProvider(profileData, preferences);
  return suggestArticles(profileData, preferences);
}

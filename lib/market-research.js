import { boundedList } from "./independent-mode";

const maxTargets = 3;
const maxHitsPerTarget = 20;
const ignoredTerms = new Set(["the", "and", "for", "with", "from", "what", "how", "system", "practical", "guide", "article", "work"]);

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ").slice(0, 80);
}

function terms(value) {
  return normalize(value).split(/[\s-]+/).filter((term) => term.length > 2 && !ignoredTerms.has(term));
}

function postTypeFor(suggestion) {
  const text = `${suggestion.title} ${suggestion.problem} ${suggestion.solution}`.toLowerCase();
  if (text.includes("learned") || text.includes("building")) return "case study";
  if (text.includes("reliable") || text.includes("system")) return "architecture guide";
  if (text.includes("how") || text.includes("practical")) return "practical guide";
  return "problem-solution";
}

function targetTerms(suggestion, profileData, preferences) {
  const evidenceRepositories = (profileData.repositories || []).filter((repo) => suggestion.evidence?.includes(repo.full_name));
  return [...new Set([
    ...(suggestion.tags || []),
    ...(preferences.topics || []),
    ...(profileData.topics || []),
    ...(profileData.languages || []),
    ...evidenceRepositories.flatMap((repo) => [repo.name, repo.description, ...(repo.topics || [])]),
  ].flatMap(terms))].slice(0, 8);
}

function relevanceFor(hit, topicTerms) {
  const text = normalize(`${hit.title || ""} ${hit.story_text || ""} ${hit.url || ""}`);
  return topicTerms.length ? topicTerms.filter((term) => text.includes(term)).length / topicTerms.length : 0;
}

function scoreTopic(hits, suggestion, repositories, relevance) {
  const totalPoints = hits.reduce((sum, hit) => sum + Math.max(0, hit.points || 0), 0);
  const totalComments = hits.reduce((sum, hit) => sum + Math.max(0, hit.num_comments || 0), 0);
  const freshness = hits.length ? hits.filter((hit) => Date.now() - new Date(hit.created_at).getTime() < 30 * 24 * 60 * 60 * 1000).length / hits.length : 0;
  const evidenceNames = new Set(suggestion.evidence || []);
  const suggestionTerms = terms(`${suggestion.title} ${suggestion.problem}`);
  const evidenceFit = Math.min(1, repositories.filter((repo) => evidenceNames.has(repo.full_name) || suggestionTerms.some((term) => terms(`${repo.description || ""} ${(repo.topics || []).join(" ")}`).includes(term))).length / 3);
  const demand = Math.min(1, hits.length / 8);
  const engagement = Math.min(1, (totalPoints / 500 + totalComments / 100) / 2);
  const score = Math.round(relevance * 30 + demand * 25 + engagement * 20 + freshness * 15 + evidenceFit * 10);
  return { score, relevance: Math.round(relevance * 100), demand: Math.round(demand * 100), engagement: Math.round(engagement * 100), freshness: Math.round(freshness * 100), evidence_fit: Math.round(evidenceFit * 100), total_points: totalPoints, total_comments: totalComments };
}

export async function researchMarket(profileData, preferences = {}) {
  const suggestions = boundedList(profileData.suggestions, maxTargets);
  const targets = suggestions.map((suggestion) => ({ suggestion, topicTerms: targetTerms(suggestion, profileData, preferences) }));
  const results = await Promise.all(targets.map(async ({ suggestion, topicTerms }) => {
    const termResults = await Promise.all(topicTerms.slice(0, 4).map(async (term) => {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(term)}&tags=story&hitsPerPage=${maxHitsPerTarget}`;
      const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "article-pulse-market-research" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Market research source returned HTTP ${response.status}.`);
      const payload = await response.json();
      return boundedList(payload.hits, maxHitsPerTarget);
    }));
    const uniqueHits = new Map(termResults.flat().map((hit) => [hit.objectID, hit]));
    const hits = [...uniqueHits.values()]
      .map((hit) => ({ ...hit, relevance: relevanceFor(hit, topicTerms) }))
      .filter((hit) => hit.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance || (b.points || 0) - (a.points || 0))
      .slice(0, maxHitsPerTarget);
    return { suggestion, topic: topicTerms.slice(0, 4).join(", "), topicTerms, hits };
  }));
  return suggestions.map((suggestion) => {
    const result = results.find((item) => item.suggestion.title === suggestion.title) || { topic: "", topicTerms: [], hits: [] };
    const relevance = result.hits.length ? result.hits.reduce((sum, hit) => sum + hit.relevance, 0) / result.hits.length : 0;
    const score = scoreTopic(result.hits, suggestion, profileData.repositories || [], relevance);
    return {
      ...suggestion,
      post_type: postTypeFor(suggestion),
      market: {
        topic: result.topic,
        query_terms: result.topicTerms,
        opportunity_score: score.score,
        confidence: score.evidence_fit >= 50 && score.relevance >= 50 && result.hits.length >= 5 ? "medium" : "low",
        signals: score,
        ranking_note: score.score >= 70 ? "Strong related conversation plus relevant project evidence. Differentiate with original results." : score.score >= 45 ? "Related signal exists, but the article needs a specific outcome and fresh evidence." : "Insufficiently related market signal. Narrow the topic to your actual project work before publishing.",
        researched_at: new Date().toISOString(),
        sources: result.hits.slice(0, 5).map((hit) => ({ title: hit.title, url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, points: hit.points || 0, comments: hit.num_comments || 0, created_at: hit.created_at, relevance: Math.round(hit.relevance * 100) })),
      },
    };
  }).sort((a, b) => b.market.opportunity_score - a.market.opportunity_score);
}

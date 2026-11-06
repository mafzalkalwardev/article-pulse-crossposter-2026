import { boundedList } from "./independent-mode";

const maxTopics = 3;
const maxHitsPerTopic = 20;

function normalizeTopic(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ").slice(0, 60);
}

function postTypeFor(suggestion) {
  const text = `${suggestion.title} ${suggestion.problem} ${suggestion.solution}`.toLowerCase();
  if (text.includes("learned") || text.includes("building")) return "case study";
  if (text.includes("reliable") || text.includes("system")) return "architecture guide";
  if (text.includes("how") || text.includes("practical")) return "practical guide";
  return "problem-solution";
}

function scoreTopic(hits, suggestion, repositories) {
  const totalPoints = hits.reduce((sum, hit) => sum + Math.max(0, hit.points || 0), 0);
  const totalComments = hits.reduce((sum, hit) => sum + Math.max(0, hit.num_comments || 0), 0);
  const freshness = hits.length
    ? hits.filter((hit) => Date.now() - new Date(hit.created_at).getTime() < 30 * 24 * 60 * 60 * 1000).length / hits.length
    : 0;
  const evidenceFit = Math.min(1, repositories.filter((repo) => `${repo.description || ""} ${(repo.topics || []).join(" ")}`.toLowerCase().includes(normalizeTopic(suggestion.title).split(" ")[0])).length / 3);
  const demand = Math.min(1, hits.length / maxHitsPerTopic);
  const engagement = Math.min(1, (totalPoints / 500 + totalComments / 100) / 2);
  const score = Math.round((demand * 35 + engagement * 30 + freshness * 20 + evidenceFit * 15));
  return { score, demand: Math.round(demand * 100), engagement: Math.round(engagement * 100), freshness: Math.round(freshness * 100), evidence_fit: Math.round(evidenceFit * 100), total_points: totalPoints, total_comments: totalComments };
}

export async function researchMarket(profileData) {
  const suggestions = boundedList(profileData.suggestions, 3);
  const topics = [...new Set(
    suggestions.flatMap((suggestion) => [
      ...(suggestion.tags || []),
      suggestion.title,
      ...(profileData.topics || []),
      ...(profileData.languages || []),
    ]).map(normalizeTopic).filter(Boolean),
  )].slice(0, maxTopics);
  const results = await Promise.all(topics.map(async (topic) => {
    const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=${maxHitsPerTopic}`;
    const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "article-pulse-market-research" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Market research source returned HTTP ${response.status}.`);
    const payload = await response.json();
    return { topic, hits: boundedList(payload.hits, maxHitsPerTopic) };
  }));
  const researchByTopic = new Map(results.map((result) => [result.topic, result]));
  return suggestions.map((suggestion) => {
    const topic = normalizeTopic(suggestion.tags?.[0] || suggestion.title);
    const result = researchByTopic.get(topic) || results[0] || { topic, hits: [] };
    const score = scoreTopic(result.hits, suggestion, profileData.repositories || []);
    return {
      ...suggestion,
      post_type: postTypeFor(suggestion),
      market: {
        topic: result.topic,
        opportunity_score: score.score,
        confidence: score.evidence_fit >= 50 && result.hits.length >= 5 ? "medium" : "low",
        signals: score,
        ranking_note: score.score >= 70 ? "Strong current conversation plus relevant evidence. Differentiate with original results." : score.score >= 45 ? "Promising angle, but the article needs a specific outcome and fresh evidence." : "Weak or crowded signal. Narrow the question before publishing.",
        researched_at: new Date().toISOString(),
        sources: result.hits.slice(0, 5).map((hit) => ({ title: hit.title, url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, points: hit.points || 0, comments: hit.num_comments || 0, created_at: hit.created_at })),
      },
    };
  }).sort((a, b) => b.market.opportunity_score - a.market.opportunity_score);
}

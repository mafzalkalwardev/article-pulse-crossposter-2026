export const INDEPENDENT_MODE = Object.freeze({
  usesAiServices: false,
  usesModelApis: false,
  usesUserTokensForGeneration: false,
  maxRepositoriesPerSync: 100,
  maxSuggestionsPerSync: 3,
});

export function assertIndependentEndpoint(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "api.github.com") {
    throw new Error("Independent mode only permits GitHub's public API.");
  }
  return parsed;
}

export function boundedList(items, limit) {
  return Array.isArray(items) ? items.slice(0, limit) : [];
}

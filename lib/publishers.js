const HASHNODE_ENDPOINT = "https://gql-beta.hashnode.com/";

async function hashnodeRequest(apiToken, query, variables = {}) {
  const response = await fetch(HASHNODE_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}`, "x-hashnode-client": "article-pulse", "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Hashnode API failed with HTTP ${response.status}.`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors[0].message);
  return result.data;
}

export async function verifyHashnodeConnection({ apiToken, publicationId }) {
  const data = await hashnodeRequest(apiToken, "query Verify($publicationId: ID!) { me { id username } publication(id: $publicationId) { id title } }", { publicationId });
  if (!data?.me?.id) throw new Error("Hashnode token was not accepted.");
  if (!data?.publication?.id) throw new Error("Hashnode publication was not found or is not accessible to this account.");
  return { username: data.me.username, publication: data.publication };
}

export async function publishToDevTo({ apiKey, article }) {
  const response = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ article: { title: article.title, body_markdown: article.body, published: true, tags: article.tags.slice(0, 4), canonical_url: article.canonical_url || undefined } }),
  });
  if (!response.ok) throw new Error(`dev.to publish failed with ${response.status}`);
  return response.json();
}

export async function publishToHashnode({ apiToken, publicationId, article }) {
  const data = await hashnodeRequest(apiToken, "mutation Publish($input: PublishPostInput!) { publishPost(input: $input) { post { id slug url title } } }", {
    input: { publicationId, title: article.title, contentMarkdown: article.body, tags: article.tags.slice(0, 5).map((name) => ({ slug: name.toLowerCase().replace(/[^a-z0-9-]/g, "-") })), originalArticleURL: article.canonical_url || undefined },
  });
  return data.publishPost.post;
}

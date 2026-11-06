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
  const response = await fetch("https://gql.hashnode.com/", {
    method: "POST",
    headers: { authorization: apiToken, "content-type": "application/json" },
    body: JSON.stringify({
      query: "mutation Publish($input: CreatePublicationPostInput!) { createPublicationPost(input: $input) { post { id url } } }",
      variables: { input: { publicationId, title: article.title, contentMarkdown: article.body, tags: article.tags.slice(0, 5).map((name) => ({ name })), originalArticleURL: article.canonical_url || undefined } },
    }),
  });
  if (!response.ok) throw new Error(`Hashnode publish failed with ${response.status}`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors[0].message);
  return result.data.createPublicationPost.post;
}

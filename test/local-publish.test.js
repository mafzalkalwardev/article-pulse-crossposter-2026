import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.closeAllConnections?.();
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

describe("local publishing cycle", { concurrency: 1 }, () => {
  let publisher;

  before(async () => {
    process.env.PUBLISH_LOOP = "false";
    process.env.APP_ENCRYPTION_KEY = "local-test-encryption-key";
    publisher = await import("../lib/local-publisher.js");
  });

  after(() => {
    publisher?.stopPublishLoop();
    process.env.PUBLISH_LOOP = "false";
  });

  test("rejects a dev.to key the platform does not accept", async () => {
    const devto = createServer((request, response) => {
      sendJson(response, 401, { error: "unauthorized" });
    });
    const directory = await mkdtemp(join(tmpdir(), "article-pulse-reject-"));
    const port = await listen(devto);
    process.env.DEVTO_API_BASE = `http://127.0.0.1:${port}`;
    process.env.LOCAL_CONNECTIONS_FILE = join(directory, "connections.json");
    process.env.PUBLICATION_STATE_FILE = join(directory, "state.json");
    process.env.ARTICLES_DIR = join(directory, "articles");
    try {
      await assert.rejects(
        () => publisher.saveConnection({ provider: "devto", secret: "rejected-devto-key" }),
        /not accepted/,
      );
      const status = await publisher.getPublishStatus();
      assert.equal(status.connections.devto.connected, false);
      assert.equal(status.connections.hashnode.connected, false);
      await assert.rejects(() => readFile(process.env.LOCAL_CONNECTIONS_FILE, "utf8"));
    } finally {
      await close(devto);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("publishes one ready article to each platform and skips it on the next cycle", async () => {
    const devtoPosts = [];
    const hashnodePosts = [];
    const devto = createServer(async (request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/api/users/me") {
        if (request.headers["api-key"] !== "test-devto-key") {
          sendJson(response, 401, { error: "unauthorized" });
          return;
        }
        sendJson(response, 200, { id: 42, username: "local-tester", name: "Local Tester" });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/articles") {
        const article = JSON.parse(await readBody(request));
        devtoPosts.push({ apiKey: request.headers["api-key"], article: article.article });
        sendJson(response, 201, {
          id: 900 + devtoPosts.length,
          url: `https://dev.to/local-tester/ready-article-${devtoPosts.length}`,
          title: article.article.title,
        });
        return;
      }
      sendJson(response, 404, { error: "not found" });
    });
    const hashnode = createServer(async (request, response) => {
      const payload = JSON.parse(await readBody(request) || "{}");
      const query = String(payload.query || "");
      if (request.headers.authorization !== "Bearer test-hashnode-token") {
        sendJson(response, 401, { errors: [{ message: "unauthorized" }] });
        return;
      }
      if (query.includes("publishPost")) {
        hashnodePosts.push({ authorization: request.headers.authorization, input: payload.variables.input });
        const input = payload.variables.input;
        sendJson(response, 200, {
          data: {
            publishPost: {
              post: {
                id: `hn_${hashnodePosts.length}`,
                slug: "ready-article",
                url: `https://hashnode.local/ready-article-${hashnodePosts.length}`,
                title: input.title,
              },
            },
          },
        });
        return;
      }
      const publicationId = payload.variables?.publicationId;
      sendJson(response, 200, {
        data: {
          me: { id: "me_local", username: "local-tester" },
          publication: publicationId === "pub_local_test" ? { id: publicationId, title: "Local Publication" } : null,
        },
      });
    });

    const directory = await mkdtemp(join(tmpdir(), "article-pulse-cycle-"));
    const articles = join(directory, "articles");
    await mkdir(articles);
    await writeFile(join(articles, "ready.md"), `---
title: "Ready Article"
description: "Ready to publish"
tags:
  - automation
  - testing
canonical_url: "https://example.com/ready-article"
publish: true
---

READY_BODY_MARKER
`);
    await writeFile(join(articles, "draft.md"), `---
title: "Draft Article"
description: "Still in review"
tags: ["drafts"]
publish: false
---

DRAFT_BODY_MARKER
The notes mention publish: true, but this file is a draft.
`);

    const devtoPort = await listen(devto);
    const hashnodePort = await listen(hashnode);
    process.env.DEVTO_API_BASE = `http://127.0.0.1:${devtoPort}`;
    process.env.HASHNODE_ENDPOINT = `http://127.0.0.1:${hashnodePort}/`;
    process.env.ARTICLES_DIR = articles;
    process.env.PUBLICATION_STATE_FILE = join(directory, "state.json");
    process.env.LOCAL_CONNECTIONS_FILE = join(directory, "connections.json");

    try {
      const before = await publisher.getPublishStatus();
      assert.equal(before.connections.devto.connected, false);
      assert.equal(before.connections.hashnode.connected, false);
      assert.equal(before.readyCount, 1);
      assert.equal(before.draftCount, 1);

      const savedDevto = await publisher.saveConnection({ provider: "devto", secret: "test-devto-key" });
      const savedHashnode = await publisher.saveConnection({
        provider: "hashnode",
        secret: "test-hashnode-token",
        publicationId: "pub_local_test",
      });
      assert.equal(savedDevto.connected, true);
      assert.equal(savedDevto.username, "local-tester");
      assert.equal(savedHashnode.connected, true);
      assert.equal(savedHashnode.publicationId, "pub_local_test");

      const storedSecrets = await readFile(process.env.LOCAL_CONNECTIONS_FILE, "utf8");
      assert.equal(storedSecrets.includes("test-devto-key"), false);
      assert.equal(storedSecrets.includes("test-hashnode-token"), false);

      const first = await publisher.runPublishCycle();
      assert.equal(devtoPosts.length, 1);
      assert.equal(hashnodePosts.length, 1);
      assert.equal(devtoPosts[0].apiKey, "test-devto-key");
      assert.equal(devtoPosts[0].article.title, "Ready Article");
      assert.equal(devtoPosts[0].article.published, true);
      assert.match(devtoPosts[0].article.body_markdown, /READY_BODY_MARKER/);
      assert.equal(JSON.stringify(devtoPosts).includes("Draft Article"), false);
      assert.equal(JSON.stringify(devtoPosts).includes("DRAFT_BODY_MARKER"), false);
      assert.equal(hashnodePosts[0].authorization, "Bearer test-hashnode-token");
      assert.equal(hashnodePosts[0].input.title, "Ready Article");
      assert.equal(hashnodePosts[0].input.publicationId, "pub_local_test");
      assert.match(hashnodePosts[0].input.contentMarkdown, /READY_BODY_MARKER/);
      assert.equal(JSON.stringify(hashnodePosts).includes("Draft Article"), false);
      assert.equal(JSON.stringify(hashnodePosts).includes("DRAFT_BODY_MARKER"), false);
      assert.equal(first.draftCount, 1);
      assert.equal(first.results.length, 1);
      assert.equal(first.results[0].platforms.devto.status, "published");
      assert.equal(first.results[0].platforms.hashnode.status, "published");
      assert.equal(first.results[0].platforms.devto.url, "https://dev.to/local-tester/ready-article-1");
      assert.equal(first.results[0].platforms.hashnode.url, "https://hashnode.local/ready-article-1");

      const second = await publisher.runPublishCycle();
      assert.equal(devtoPosts.length, 1);
      assert.equal(hashnodePosts.length, 1);
      assert.equal(second.results[0].platforms.devto.status, "skipped");
      assert.equal(second.results[0].platforms.hashnode.status, "skipped");
      assert.equal(second.results[0].platforms.devto.id, 901);
      assert.equal(second.results[0].platforms.hashnode.id, "hn_1");

      const afterCycle = await publisher.getPublishStatus();
      assert.equal(afterCycle.connections.devto.connected, true);
      assert.equal(afterCycle.connections.hashnode.connected, true);
      assert.equal(afterCycle.readyCount, 1);
      assert.equal(afterCycle.lastCycle.results[0].platforms.devto.status, "skipped");
    } finally {
      await close(devto);
      await close(hashnode);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("the publish loop timer does not hold the event loop open", async () => {
    process.env.PUBLISH_LOOP = "false";
    const disabled = await publisher.getPublishStatus();
    assert.equal(disabled.loop.enabled, false);
    assert.equal(disabled.loop.intervalMinutes, 15);

    process.env.PUBLISH_LOOP = "true";
    const timer = publisher.startPublishLoop();
    assert.ok(timer);
    assert.equal(timer.hasRef(), false);
    const enabled = await publisher.getPublishStatus();
    assert.equal(enabled.loop.enabled, true);
    assert.equal(enabled.loop.intervalMs, 15 * 60 * 1000);
    publisher.stopPublishLoop();
    process.env.PUBLISH_LOOP = "false";
  });
});

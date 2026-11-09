import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join } from "node:path";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { parseMarkdownArticle } from "./markdown-article.js";
import { publishToDevTo, publishToHashnode, verifyDevToConnection, verifyHashnodeConnection } from "./publishers.js";

const LOOP_KEY = Symbol.for("article-pulse.local-publish-loop");
const INTERVAL_MS = 15 * 60 * 1000;

function resolvePath(value, fallback) {
  if (!value) return fallback;
  return isAbsolute(value) ? value : join(process.cwd(), value);
}

export function connectionsPath() {
  return resolvePath(process.env.LOCAL_CONNECTIONS_FILE, join(process.cwd(), "data", "local-connections.json"));
}

export function publicationStatePath() {
  return resolvePath(process.env.PUBLICATION_STATE_FILE, join(process.cwd(), ".article-publisher-state.json"));
}

export function articlesDirectory() {
  return resolvePath(process.env.ARTICLES_DIR, join(process.cwd(), "articles"));
}

export function isPublishLoopEnabled() {
  if (process.env.PUBLISH_LOOP === "false") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
}

async function readConnections() {
  const stored = await readJson(connectionsPath(), {});
  return stored && typeof stored === "object" ? stored : {};
}

async function readState() {
  const stored = await readJson(publicationStatePath(), {});
  return {
    publications: stored?.publications && typeof stored.publications === "object" ? stored.publications : {},
    lastCycle: stored?.lastCycle || null,
  };
}

async function writeState(state) {
  await writeJson(publicationStatePath(), state);
}

export async function listMarkdownArticles() {
  let entries;
  try {
    entries = await readdir(articlesDirectory(), { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const files = entries
    .filter((entry) => entry.isFile() && [".md", ".markdown"].includes(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
  const articles = [];
  for (const file of files) {
    const source = await readFile(join(articlesDirectory(), file), "utf8");
    articles.push(parseMarkdownArticle(source, file));
  }
  return articles;
}

function succeeded(entry) {
  return Boolean(entry && (entry.id != null || entry.url));
}

function connectionView(connection, provider) {
  if (!connection?.encryptedSecret || !connection.verifiedAt) return { connected: false };
  if (provider === "hashnode") {
    return {
      connected: true,
      username: connection.username || null,
      publicationId: connection.publicationId || null,
      publicationTitle: connection.publicationTitle || null,
    };
  }
  return { connected: true, username: connection.username || null };
}

export async function getPublishStatus() {
  const [articles, connections, state] = await Promise.all([listMarkdownArticles(), readConnections(), readState()]);
  return {
    loop: {
      enabled: isPublishLoopEnabled(),
      intervalMs: INTERVAL_MS,
      intervalMinutes: INTERVAL_MS / 60000,
    },
    connections: {
      devto: connectionView(connections.devto, "devto"),
      hashnode: connectionView(connections.hashnode, "hashnode"),
    },
    readyCount: articles.filter((article) => article.publish).length,
    draftCount: articles.filter((article) => !article.publish).length,
    lastCycle: state.lastCycle,
  };
}

export async function saveConnection({ provider, secret, publicationId }) {
  if (provider === "devto") {
    const account = await verifyDevToConnection({ apiKey: secret });
    const connections = await readConnections();
    connections.devto = {
      encryptedSecret: encryptSecret(secret),
      verifiedAt: new Date().toISOString(),
      username: account.username,
      userId: account.id,
    };
    await writeJson(connectionsPath(), connections);
    return { provider: "devto", connected: true, username: account.username };
  }

  if (provider === "hashnode") {
    if (!publicationId) throw new Error("Hashnode publication ID is required.");
    const account = await verifyHashnodeConnection({ apiToken: secret, publicationId });
    const connections = await readConnections();
    connections.hashnode = {
      encryptedSecret: encryptSecret(secret),
      verifiedAt: new Date().toISOString(),
      username: account.username,
      publicationId: account.publication.id,
      publicationTitle: account.publication.title,
    };
    await writeJson(connectionsPath(), connections);
    return {
      provider: "hashnode",
      connected: true,
      username: account.username,
      publicationId: account.publication.id,
      publicationTitle: account.publication.title,
    };
  }

  throw new Error("Unsupported publishing provider.");
}

function articlePayload(article) {
  return {
    title: article.title,
    body: article.body,
    tags: article.tags,
    canonical_url: article.canonical_url,
  };
}

async function publishPlatform({ provider, article, record, connection, state }) {
  const existing = record[provider];
  if (succeeded(existing)) {
    return { status: "skipped", id: existing.id ?? null, url: existing.url ?? null };
  }
  if (!connection?.encryptedSecret || !connection.verifiedAt) {
    return { status: "not_connected" };
  }

  try {
    const secret = decryptSecret(connection.encryptedSecret);
    const published = provider === "devto"
      ? await publishToDevTo({ apiKey: secret, article: articlePayload(article) })
      : await publishToHashnode({
        apiToken: secret,
        publicationId: connection.publicationId,
        article: articlePayload(article),
      });
    const id = published?.id ?? null;
    const url = published?.url ?? null;
    if (id == null && !url) throw new Error(`${provider} did not return an id or url.`);
    record[provider] = {
      id,
      url,
      slug: published?.slug ?? null,
      publishedAt: new Date().toISOString(),
    };
    state.publications[article.file] = record;
    await writeState(state);
    return { status: "published", id, url };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Publish failed" };
  }
}

async function executePublishCycle() {
  const articles = await listMarkdownArticles();
  const ready = articles.filter((article) => article.publish);
  const drafts = articles.filter((article) => !article.publish);
  const connections = await readConnections();
  const state = await readState();
  const results = [];

  for (const article of ready) {
    const record = { ...(state.publications[article.file] || {}) };
    const devto = await publishPlatform({ provider: "devto", article, record, connection: connections.devto, state });
    const hashnode = await publishPlatform({ provider: "hashnode", article, record, connection: connections.hashnode, state });
    state.publications[article.file] = record;
    results.push({ file: article.file, title: article.title, platforms: { devto, hashnode } });
  }

  const cycle = {
    ranAt: new Date().toISOString(),
    readyCount: ready.length,
    draftCount: drafts.length,
    results,
  };
  state.lastCycle = cycle;
  await writeState(state);
  return cycle;
}

let cycleLock = null;

export function runPublishCycle() {
  if (!cycleLock) {
    cycleLock = executePublishCycle().finally(() => {
      cycleLock = null;
    });
  }
  return cycleLock;
}

export function startPublishLoop() {
  if (!isPublishLoopEnabled()) return null;
  if (globalThis[LOOP_KEY]) return globalThis[LOOP_KEY];
  const timer = setInterval(() => {
    runPublishCycle().catch((error) => {
      const message = error instanceof Error ? error.message : "cycle failed";
      console.error(`[publish-loop] ${message}`);
    });
  }, INTERVAL_MS);
  // unref so an imported module cannot keep node:test (or a one-shot script) alive
  timer.unref();
  globalThis[LOOP_KEY] = timer;
  return timer;
}

export function stopPublishLoop() {
  const timer = globalThis[LOOP_KEY];
  if (timer) clearInterval(timer);
  delete globalThis[LOOP_KEY];
}

startPublishLoop();

import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const articlesDir = join(root, "articles");
const port = Number(process.env.PORT || 4173);

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

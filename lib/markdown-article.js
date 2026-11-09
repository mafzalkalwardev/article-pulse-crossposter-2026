function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw
      .slice(1, -1)
      .split(",")
      .map((item) => unquote(item))
      .filter(Boolean);
  }
  return unquote(raw);
}

export function parseFrontMatter(block) {
  const data = {};
  let listKey = null;
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && listKey) {
      data[listKey].push(unquote(listItem[1]));
      continue;
    }
    const field = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!field) continue;
    const key = field[1];
    const raw = field[2];
    listKey = null;
    if (raw === "") {
      data[key] = [];
      listKey = key;
      continue;
    }
    data[key] = parseScalar(raw);
  }
  return data;
}

function asTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function parseMarkdownArticle(source, filename) {
  const normalized = source.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      file: filename,
      title: filename,
      description: "",
      tags: [],
      canonical_url: "",
      cover_image: "",
      publish: false,
      body: normalized.trim(),
    };
  }
  const data = parseFrontMatter(match[1]);
  return {
    file: filename,
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : filename,
    description: typeof data.description === "string" ? data.description : "",
    tags: asTags(data.tags),
    canonical_url: typeof data.canonical_url === "string" ? data.canonical_url : "",
    cover_image: typeof data.cover_image === "string" ? data.cover_image : "",
    publish: data.publish === true,
    body: match[2].trim(),
  };
}

const articleList = document.querySelector("#article-list");
const articleCount = document.querySelector("#article-count");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

async function loadArticles() {
  articleList.innerHTML = '<div class="loading">Loading Markdown articles…</div>';
  try {
    const response = await fetch("/api/articles");
    if (!response.ok) throw new Error("Article API unavailable");
    const { articles } = await response.json();
    articleCount.textContent = `${articles.length} files`;
    articleList.innerHTML = articles.length
      ? articles.map((article) => `
        <div class="article-row">
          <span class="article-file">MD</span>
          <div><strong>${article.title}</strong><span>${article.file}${article.tags.length ? ` · ${article.tags.join(", ")}` : ""}</span></div>
          <span class="${article.status === "Ready" ? "ready" : "draft"}">${article.status}</span>
        </div>`).join("")
      : '<div class="loading">No Markdown articles yet. Add one to the articles folder.</div>';
  } catch (error) {
    articleCount.textContent = "Offline";
    articleList.innerHTML = '<div class="loading">Could not load the content queue.</div>';
    showToast(error.message);
  }
}

document.querySelector("#refresh-button").addEventListener("click", () => {
  loadArticles();
  showToast("Workspace refreshed");
});
document.querySelector("#preview-button").addEventListener("click", () => showToast("Preview mode is ready for the next approved article"));
document.querySelector("#generate-button").addEventListener("click", async () => {
  const button = document.querySelector("#generate-button");
  button.disabled = true;
  button.innerHTML = "Generating locally…";
  try {
    const response = await fetch("/api/growth/generate", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Generation failed");
    document.querySelector("#profile-summary").textContent = `Drafted ${result.filename} with ${result.tags.length} SEO tags from ${result.profile.login}'s public work.`;
    showToast("Draft and cover image generated locally");
    await loadArticles();
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = "Generate from GitHub <span>↗</span>";
  }
});
loadArticles();

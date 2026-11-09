export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPublishLoop } = await import("./lib/local-publisher.js");
    startPublishLoop();
  }
}

import { NextResponse } from "next/server";

export async function GET(request) {
  if (!process.env.GITHUB_CLIENT_ID) {
    return NextResponse.json({ error: "GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable account connection." }, { status: 503 });
  }
  const redirectUri = `${new URL(request.url).origin}/api/github/connect/callback`;
  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", redirectUri);
  githubUrl.searchParams.set("scope", "read:user,repo");
  return NextResponse.redirect(githubUrl);
}

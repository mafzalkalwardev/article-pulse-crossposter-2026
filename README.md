# Article Pulse Crossposter

![Article Pulse Crossposter logo](assets/logo.svg)

Automate approved Markdown article publishing to **Hashnode** and **dev.to** from one local, reproducible content workflow.

![Publishing workflow](assets/workflow.svg)

## Product preview

The repository includes a lightweight local frontend and backend. Start it with:

```bash
npm start
```

Then open `http://localhost:4173`. The frontend is a responsive publishing control room; the backend serves the static app and exposes `GET /api/health` and `GET /api/articles` for the Markdown queue.

![Article Pulse dashboard](assets/dashboard-preview.svg)

## Features

- **Markdown-first publishing**: keep articles in version-controlled Markdown files.
- **Hashnode and dev.to cross-posting**: publish one canonical article to both developer platforms.
- **Canonical URL support**: preserve SEO attribution to the source publication.
- **Front matter metadata**: define title, description, tags, cover image, canonical URL, and publication state beside the article.
- **Idempotent publishing**: record platform publication IDs so reruns do not create accidental duplicates.
- **Local-first privacy**: API tokens remain on the machine and are never committed.
- **Dry-run validation**: inspect transformed payloads before sending them.
- **Scheduling-ready design**: run manually or from a local daily schedule.
- **Audit trail**: keep publication results and errors in a local state file.
- **Public documentation**: the workflow, configuration, and operational boundaries are documented here.
- **Dashboard UI**: see the current publishing queue, schedule, delivery health, and recent activity at a glance.
- **Backend API**: use the local API as the integration boundary for future Hashnode and dev.to publishing adapters.
- **Independent Growth Mode**: derive topics from public GitHub profile and repository signals, then generate reviewable article drafts, SEO metadata, critical questions, problem/solution structure, and original SVG cover art locally without AI services or AI tokens.

## Why this project exists

Publishing consistently across multiple developer blogging platforms is repetitive and error-prone. Article Pulse Crossposter turns a single approved Markdown article into platform-specific publishing requests while keeping source content, credentials, and publication history under your control.

## Content format

Articles should use YAML front matter:

```markdown
---
title: "A practical guide to reliable automation"
description: "A concise introduction to building dependable content workflows."
tags:
  - automation
  - developer-tools
cover_image: "https://example.com/cover.png"
canonical_url: "https://example.com/articles/reliable-automation"
publish: true
---

# A practical guide to reliable automation

Your article content goes here.
```

The `publish: true` flag is an explicit publishing boundary. Files without it are ignored by the publisher.

## Planned workflow

1. Add or update an approved Markdown article.
2. Validate front matter and required metadata.
3. Run a dry run and review the generated platform payloads.
4. Publish to Hashnode and dev.to.
5. Save returned URLs and IDs to the local publication state.
6. Review failures and retry only the affected platform.

## Hosted application

Article Pulse now includes a production-oriented Next.js + Supabase application foundation:

- Magic-link account creation and sign-in.
- Supabase profiles, articles, and publishing-connection persistence with row-level security.
- GitHub profile/repository synchronization.
- Deterministic article suggestions grounded in project evidence.
- Encrypted connection secret storage using AES-256-GCM.
- Hashnode GraphQL and dev.to publishing adapters.
- Draft-first publishing boundaries and idempotent target tracking fields.
- Secure provider connection UI for GitHub, Hashnode, and dev.to.
- Vercel cron endpoint for scheduled publishing runs.
- Per-user content identity: GitHub profile URL, topics, audience, tone, article formats, image style, and alt-text rules.

Run the web app locally:

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Apply `supabase/migrations/001_initial.sql` to a Supabase project, then configure the environment variables in `.env.local` and Vercel.

### Deploying online

1. Create a Supabase project and run the SQL migration.
2. Enable Supabase email magic links and set the callback URL to `/auth/callback`.
3. Import this repository into Vercel.
4. Add the variables from `.env.local.example`, plus a random `CRON_SECRET`.
5. Add the Vercel production URL to Supabase Auth redirect URLs.
6. Configure GitHub, Hashnode, and dev.to credentials from the authenticated dashboard.

The application is intentionally not claimed as deployed until those project credentials and redirect URLs exist. The repository contains the complete hosted application boundary, but Vercel and Supabase are separate user-owned services.

### Content identity

Each account can provide a GitHub profile URL and a durable publishing profile. The profile controls what suggestions emphasize and how generated drafts are shaped:

- topics and areas of expertise
- target audience
- writing tone
- preferred article formats
- preferred visual style
- image alt-text description rules

Authenticated profiles are stored in the user's Supabase `profiles.preferences` JSON document under row-level security. Demo mode stores the same settings only in browser local storage. A GitHub URL is validated to `github.com` before public repository data is synchronized.

## Local configuration

Copy `.env.example` to `.env` and provide tokens locally. Never commit `.env`.

The publishing integration is intentionally not enabled by default. Before enabling it, configure:

- Hashnode API token and publication identifier.
- dev.to API key.
- Source article directory.
- Daily run time and local timezone.
- Whether a canonical URL is required before publishing.

## Independent Growth Mode

The dashboard's **Generate from GitHub** option reads only public data from the configured GitHub username (`GITHUB_USERNAME`, default `mafzalkalwardev`). It uses deterministic templates and local code to:

1. Identify recurring languages, topics, and public projects.
2. Create critical questions grounded in those signals.
3. Write a problem/solution field note with explicit public-evidence boundaries.
4. Generate focused title, description, tags, and canonical-image metadata.
5. Render a unique SVG cover locally and save both files under `articles\` and `assets\generated\`.

Generated drafts start with `publish: false`. This protects against fabricated claims, accidental duplicates, and automatic public posting before the author has reviewed the facts. The existing local scheduler can publish only after the draft is deliberately marked ready and platform credentials are configured.

For unattended publishing, set `GROWTH_AUTO_PUBLISH=true` only after configuring and testing the Hashnode/dev.to credentials. This changes generated front matter to `publish: true`; it still does not bypass platform authentication, duplicate protection, or the local scheduler.

### Demo GitHub connection

Without Supabase, enter a public GitHub profile URL in the dashboard and choose **Connect GitHub account**. The demo fetches only public profile and repository fields from GitHub, generates suggestions from that real data, and writes the result to `data\demo-profile.json` (ignored by Git). No GitHub token or database is required for this test path.

### Independent mode and limits

Article Pulse's generation path is intentionally **not AI-powered**. It has no AI SDK, model endpoint, prompt runner, or AI generation token. Titles, questions, solutions, tags, and formatting are produced by deterministic JavaScript templates from the user's saved preferences and public GitHub fields.

The demo also bounds external work: one sync uses at most 100 repositories, returns at most 3 suggestions, calls only `https://api.github.com`, and allows at most 6 demo sync requests per minute per running process. It does not scrape private data or bypass GitHub authentication/rate limits.

### Optional AI-assisted intelligence

The dashboard now has two modes. **Deterministic** remains the default and requires no AI credentials. **AI-assisted** is an explicit opt-in that sends a bounded, public GitHub summary to an OpenAI-compatible server-side endpoint configured with `INTELLIGENCE_PROVIDER_URL`, `INTELLIGENCE_API_KEY`, and optionally `INTELLIGENCE_MODEL`. Provider credentials are never sent to the browser. The response is parsed and evidence-checked before suggestions are shown; if the provider is unavailable, the request fails clearly instead of silently switching modes.

### Connect and publish to Hashnode

The local demo intentionally does not store real publishing credentials. For live Hashnode publishing:

1. Create a Supabase project and run `supabase\migrations\001_initial.sql` and `supabase\migrations\002_content_identity.sql`.
2. Copy `.env.local.example` to `.env.local` and set the Supabase URL, anon key, service-role key, `APP_ENCRYPTION_KEY`, and `NEXT_PUBLIC_APP_URL`.
3. Restart Next.js so `/dashboard` leaves demo mode.
4. Sign in to Hashnode with Google in the browser.
5. In Hashnode Account settings → Developer / API tokens, create a Personal Access Token. Do not paste it into chat or commit it.
6. In Article Pulse choose **Hashnode Personal Access Token**, enter the token and the publication ID, then choose **Connect your Hashnode account**.
7. Article Pulse verifies the token and publication before encrypting and storing the credential in Supabase.
8. Create a reviewable draft, inspect its market evidence, and publish only after confirming the final content. Hashnode API publishing may require the publication's Pro plan and the account must have permission to publish.

Google login is used on Hashnode's website; the publishing API itself uses the Personal Access Token. Demo mode will not claim that a real Hashnode account was connected.

### Market research before a post

Before drafting, the dashboard can query current public Hacker News discussions for up to three candidate topics. It assigns each idea a transparent opportunity estimate from conversation volume, points/comments, freshness, and fit with the user's repository evidence. It also recommends a format such as a case study, architecture guide, practical guide, or problem-solution post. This is a prioritization signal, not a promise that an article will rank: search placement also depends on originality, quality, links, indexing, competition, and reader response.

## SEO guidance

- Write a unique, descriptive title for each article.
- Keep the description useful as a search-result summary.
- Use focused tags rather than a long tag list.
- Set a canonical URL when the article has a primary home.
- Use descriptive headings and meaningful link text.
- Add a cover image with useful alt text where supported.
- Avoid publishing thin, duplicated, or unreviewed content.

## Safety and operational boundaries

- This repository stores configuration templates, not credentials.
- The local automation is personal to the machine where it runs.
- A public GitHub repository does not make the local scheduler shared or cloud-hosted.
- Publishing should remain paused until API credentials, content rules, and the daily schedule are reviewed.

## License

Choose a license before accepting outside contributions.

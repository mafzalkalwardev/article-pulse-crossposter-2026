import { NextResponse } from "next/server";
import { z } from "zod";
import { researchMarket } from "../../../lib/market-research";

const requestSchema = z.object({
  profile: z.object({
    repositories: z.array(z.object({ description: z.string().nullable().optional(), topics: z.array(z.string()).optional() })).max(100),
    topics: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    suggestions: z.array(z.object({
      title: z.string(),
      problem: z.string(),
      solution: z.string(),
      evidence: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })).max(3),
  }),
});

export async function POST(request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Profile suggestions are required for market research." }, { status: 400 });
  try {
    return NextResponse.json({ researched_at: new Date().toISOString(), suggestions: await researchMarket(parsed.data.profile) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Market research failed." }, { status: 502 });
  }
}

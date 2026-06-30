import { NextResponse } from "next/server";
import { askDeepSeek } from "@/lib/deepseek";

type Input = {
  question: string;
  contextTitle: string;
  contextSummary: string;
  evidence: string[];
};

export async function POST(request: Request) {
  try {
    const input = await request.json() as Input;
    const answer = await askDeepSeek(input.question, input.contextTitle, input.contextSummary, input.evidence ?? []);
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: "无法读取问题。" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { analyzeBirth, validateBirth } from "@/lib/fate";
import { tokenValid } from "@/lib/unlock";
import type { BirthInput } from "@/lib/types";

// 解锁状态校验（深度章节锁用）：token 必须服务端验签，前端 localStorage 伪造无效。
export async function POST(request: Request) {
  let body: { birth?: BirthInput; token?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ unlocked: false });
  }
  if (!body.birth || validateBirth(body.birth)) return NextResponse.json({ unlocked: false });
  return NextResponse.json({ unlocked: tokenValid(analyzeBirth(body.birth).id, body.token) });
}

import { NextResponse } from "next/server";
import { analyzeBirth, validateBirth } from "@/lib/fate";
import { redeemCode } from "@/lib/unlock";
import type { BirthInput } from "@/lib/types";

// 解锁码兑换：码验签 + 首兑绑定命盘（同盘可重复兑换恢复解锁），返回无状态解锁 token。
export async function POST(request: Request) {
  let body: { code?: string; birth?: BirthInput };
  try {
    body = await request.json() as { code?: string; birth?: BirthInput };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.code || typeof body.code !== "string") return NextResponse.json({ error: "请输入解锁码。" }, { status: 400 });
  if (!body.birth) return NextResponse.json({ error: "缺少出生信息。" }, { status: 400 });
  const birthError = validateBirth(body.birth);
  if (birthError) return NextResponse.json({ error: birthError }, { status: 400 });

  const profileId = analyzeBirth(body.birth).id;
  const { token, error } = redeemCode(body.code, profileId);
  if (error || !token) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ token, profileId });
}

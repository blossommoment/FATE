import { NextResponse } from "next/server";
import { analyzeBirth, validateBirth } from "@/lib/fate";
import type { BirthInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const birth = await request.json() as BirthInput;
    const error = validateBirth(birth);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(analyzeBirth(birth));
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}

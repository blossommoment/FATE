import { NextResponse } from "next/server";
import { analyzeBirth, matchProfiles, validateBirth } from "@/lib/fate";
import type { BirthInput, UserProfile } from "@/lib/types";

type Input = BirthInput | UserProfile;
const isProfile = (value: Input): value is UserProfile => "personality" in value && "bazi" in value;

export async function POST(request: Request) {
  try {
    const { userA, userB } = await request.json() as { userA: Input; userB: Input };
    if (!userA || !userB) return NextResponse.json({ error: "userA and userB are required." }, { status: 400 });
    if (!isProfile(userA)) {
      const error = validateBirth(userA); if (error) return NextResponse.json({ error: `userA: ${error}` }, { status: 400 });
    }
    if (!isProfile(userB)) {
      const error = validateBirth(userB); if (error) return NextResponse.json({ error: `userB: ${error}` }, { status: 400 });
    }
    return NextResponse.json(matchProfiles(isProfile(userA) ? userA : analyzeBirth(userA), isProfile(userB) ? userB : analyzeBirth(userB)));
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}

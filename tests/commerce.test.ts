import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { analyzeBirth, analyzeDuoRhythm, annualGanZhiForSolar } from "../lib/fate";
import { buildStructureFacts } from "../lib/digest";
import { duoSubject, issueEntitlement, personalSubject, tokenGrants } from "../lib/entitlements";
import { openReportState, sealReportState } from "../lib/reportState";
import { verifyStripeSignature } from "../lib/stripeCheckout";
import type { BirthInput } from "../lib/types";

const a: BirthInput = { year: 1998, month: 8, day: 24, hour: 14, minute: 0, name: "Alice", gender: "female", calendarType: "solar" };
const b: BirthInput = { year: 1997, month: 11, day: 8, hour: 22, minute: 0, name: "Bob", gender: "male", calendarType: "solar" };

const original = {
  reportState: process.env.REPORT_STATE_SECRET,
  entitlement: process.env.ENTITLEMENT_SECRET,
  webhook: process.env.STRIPE_WEBHOOK_SECRET,
  reportTtl: process.env.REPORT_STATE_TTL_SECONDS,
};

beforeEach(() => {
  process.env.REPORT_STATE_SECRET = "test-report-state-secret";
  process.env.ENTITLEMENT_SECRET = "test-entitlement-secret";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
  process.env.REPORT_STATE_TTL_SECONDS = "600";
});

afterEach(() => {
  process.env.REPORT_STATE_SECRET = original.reportState;
  process.env.ENTITLEMENT_SECRET = original.entitlement;
  process.env.STRIPE_WEBHOOK_SECRET = original.webhook;
  process.env.REPORT_STATE_TTL_SECONDS = original.reportTtl;
});

describe("annual GanZhi", () => {
  it("uses LiChun rather than the Gregorian new year", () => {
    expect(annualGanZhiForSolar(2026, 2, 3, 12)).toBe("乙巳");
    expect(annualGanZhiForSolar(2026, 2, 5, 12)).toBe("丙午");
  });

  it("feeds the actual annual pillar into structure facts", () => {
    const profile = analyzeBirth(a);
    expect(buildStructureFacts(profile, new Date("2026-02-03T04:00:00.000Z")).thisYear.ganZhi).toBe("乙巳");
    expect(buildStructureFacts(profile, new Date("2026-02-05T04:00:00.000Z")).thisYear.ganZhi).toBe("丙午");
  });

  it("uses the same annual source for duo rhythm labels", () => {
    const rhythm = analyzeDuoRhythm(analyzeBirth(a), analyzeBirth(b), "恋爱", 2026, 1);
    expect(rhythm[0].ganZhi).toBe("丙午");
  });
});

describe("private report state", () => {
  it("round-trips without exposing a readable birth date", () => {
    const now = 1_700_000_000_000;
    const token = sealReportState({ birth: a, partnerBirth: b, relationType: "恋爱" }, now);
    expect(token).not.toContain("1998");
    expect(token).not.toContain("Alice");
    expect(openReportState(token, now + 1)).toMatchObject({ birth: a, partnerBirth: b, relationType: "恋爱" });
  });

  it("rejects tampered and expired state", () => {
    const now = 1_700_000_000_000;
    const token = sealReportState({ birth: a, relationType: "恋爱" }, now);
    expect(openReportState(`${token}x`, now + 1)).toBeNull();
    expect(openReportState(token, now + 601_000)).toBeNull();
  });
});

describe("entitlement signatures", () => {
  it("binds each entitlement to every report input that changes output", () => {
    expect(personalSubject(a)).not.toBe(personalSubject({ ...a, name: "Alicia" }));
    expect(duoSubject(a, b, "恋爱")).not.toBe(duoSubject(a, { ...b, gender: "female" }, "恋爱"));
  });

  it("accepts only the matching signed product and subject", () => {
    const subject = duoSubject(a, b, "恋爱");
    const token = issueEntitlement("duo_full", subject, 1_700_000_000_000);
    expect(tokenGrants(token, "duo_full", subject, 1_700_000_000_100)).toBe(true);
    expect(tokenGrants(token, "personal_full", subject, 1_700_000_000_100)).toBe(false);
    expect(tokenGrants(`${token}x`, "duo_full", subject, 1_700_000_000_100)).toBe(false);
  });
});

describe("Stripe webhook verification", () => {
  it("requires a recent valid signed payload", () => {
    const timestamp = 1_700_000_000;
    const body = '{"type":"checkout.session.completed"}';
    const signature = createHmac("sha256", "whsec_test_secret").update(`${timestamp}.${body}`).digest("hex");
    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, timestamp + 5)).toBe(true);
    expect(verifyStripeSignature(body, `t=${timestamp},v1=not-valid`, timestamp + 5)).toBe(false);
    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, timestamp + 301)).toBe(false);
  });
});

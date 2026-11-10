import { describe, expect, it } from "vitest";
import { PaymentTerms } from "../enums";
import { isNoticeTerms, noticeTermsList } from ".";

describe("notice terms", () => {
  it("lists every Net term, Net 7 to Net 90, and nothing else", () => {
    expect(noticeTermsList).toEqual([
      PaymentTerms.Net7,
      PaymentTerms.Net15,
      PaymentTerms.Net30,
      PaymentTerms.Net60,
      PaymentTerms.Net90,
    ]);
  });

  it("gives COD and prepaid no notice", () => {
    expect(isNoticeTerms(PaymentTerms.COD)).toBe(false);
    expect(isNoticeTerms(PaymentTerms.Prepaid)).toBe(false);
    expect(isNoticeTerms(PaymentTerms.Net90)).toBe(true);
  });
});

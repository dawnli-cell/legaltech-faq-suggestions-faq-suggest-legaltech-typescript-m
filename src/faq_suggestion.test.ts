import test from "node:test";
import assert from "node:assert/strict";
import { intakeRequest, rankLocalFaqs } from "./faq_suggestion.ts";

test("matter intake queries put the intake FAQ first", () => {
  const request = intakeRequest.parse({ matterType: "matter-intake", query: "new matter intake", limit: 2 });
  const result = rankLocalFaqs(request);
  assert.equal(result[0]?.id, "intake-1");
  assert.equal(result.length, 2);
});

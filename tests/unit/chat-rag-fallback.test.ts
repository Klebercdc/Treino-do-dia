import test from "node:test"
import assert from "node:assert/strict"

import { expandScienceTokens, scoreScientificTextMatch } from "../../src/ai/scienceSearchUtils"

test("expandScienceTokens amplia aliases úteis para hipertrofia e creatina", () => {
  const tokens = expandScienceTokens("hipertrofia creatina")

  assert.ok(tokens.includes("hipertrofia"))
  assert.ok(tokens.includes("hypertrophy"))
  assert.ok(tokens.includes("creatina"))
  assert.ok(tokens.includes("creatine"))
})

test("scoreScientificTextMatch prioriza evidência compatível com a consulta", () => {
  const score = scoreScientificTextMatch({
    summary: "Higher protein intake improves hypertrophy outcomes during resistance training.",
    topic: { topic: "protein intake for hypertrophy" },
    article: { title: "Dietary protein and muscle hypertrophy", journal: "Sports Nutrition Journal" },
  }, ["protein", "hypertrophy", "resistance"])

  const irrelevant = scoreScientificTextMatch({
    summary: "Hydration habits in marathon runners.",
    topic: { topic: "endurance hydration" },
    article: { title: "Fluid balance in endurance sports", journal: "Running Science" },
  }, ["protein", "hypertrophy", "resistance"])

  assert.ok(score >= 0.66)
  assert.equal(irrelevant, 0)
})

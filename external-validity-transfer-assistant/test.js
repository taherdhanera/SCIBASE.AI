const assert = require("assert");
const { project } = require("./sample-data");
const { buildReviewPacket, evaluateClaim, renderMarkdownReport, renderSvgSummary } = require("./index");

const packet = buildReviewPacket(project);

assert.strictEqual(packet.assistant, "external-validity-transfer-assistant");
assert.strictEqual(packet.issue, "SCIBASE-AI/SCIBASE.AI#16");
assert.ok(packet.peerReviewSuggestions.length >= 6, "expected transfer-risk peer review suggestions");
assert.ok(packet.reproducibilityActions.length >= 3, "expected reproducibility actions");
assert.ok(packet.researchGaps.length >= 3, "expected research-gap prompts");

const broadClaim = packet.claimReviews.find((review) => review.id === "claim-generalizable-oncology");
assert.ok(broadClaim, "expected broad generalizability claim review");
assert.ok(
  ["hold-for-transfer-evidence", "quarantine-from-review-packet"].includes(broadClaim.decision),
  "broad claim should be held or quarantined until transfer evidence exists"
);
assert.ok(
  broadClaim.findings.some((finding) => finding.rule === "population-transfer-gap"),
  "broad claim should flag missing population transfer evidence"
);
assert.ok(
  broadClaim.findings.some((finding) => finding.rule === "no-external-validation"),
  "broad claim should require external validation"
);

const reproducibleClaim = packet.claimReviews.find((review) => review.id === "claim-reproducible-pipeline");
assert.ok(reproducibleClaim.score > broadClaim.score, "reproducible claim should score better than broad claim");
assert.strictEqual(reproducibleClaim.observedScope.externalValidation, true);
assert.strictEqual(reproducibleClaim.observedScope.runnableEvidence, true);

const emptyClaim = {
  id: "claim-empty",
  text: "The model works for every lab.",
  assertedScope: {
    populations: ["adult"],
    settings: ["international site"],
    instruments: ["bulk-rna-seq"],
    environments: ["python-3.11"]
  },
  evidenceIds: [],
  confidence: "strong"
};
const emptyReview = evaluateClaim(emptyClaim, project.evidence, project.manuscript);
assert.strictEqual(emptyReview.decision, "quarantine-from-review-packet");
assert.ok(emptyReview.findings.some((finding) => finding.rule === "missing-evidence"));

const markdown = renderMarkdownReport(packet);
assert.ok(markdown.includes("## Claim Reviews"));
assert.ok(markdown.includes("## Research Gap Prompts"));

const svg = renderSvgSummary(packet);
assert.ok(svg.includes("<svg"));
assert.ok(svg.includes("External Validity Transfer Assistant"));

console.log("external-validity-transfer-assistant tests passed");

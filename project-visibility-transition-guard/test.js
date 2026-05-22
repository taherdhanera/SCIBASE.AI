const assert = require("assert");
const { project } = require("./sample-data");
const {
  buildReviewPacket,
  evaluateVisibilityTransition,
  renderMarkdownReport,
  renderSvgSummary
} = require("./index");

const evaluation = evaluateVisibilityTransition(project);
const packet = buildReviewPacket(project);

assert.strictEqual(packet.guard, "project-visibility-transition-guard");
assert.strictEqual(packet.issue, "SCIBASE-AI/SCIBASE.AI#11");
assert.strictEqual(packet.decision, "block-public-visibility-transition");

assert.ok(
  evaluation.findings.some((finding) => finding.rule === "required-visibility-approver-missing"),
  "expected missing required approver finding"
);
assert.ok(
  evaluation.findings.some((finding) => finding.rule === "sensitive-object-in-public-transition"),
  "expected sensitive object finding"
);
assert.ok(
  evaluation.findings.some((finding) => finding.rule === "unsafe-public-object-permission"),
  "expected unsafe permission finding"
);
assert.ok(
  evaluation.findings.some((finding) => finding.rule === "active-hold-blocks-public-transition"),
  "expected active hold finding"
);
assert.ok(
  evaluation.findings.some((finding) => finding.rule === "external-access-principal-unknown"),
  "expected unknown external access finding"
);

const cleanProject = JSON.parse(JSON.stringify(project));
cleanProject.collaborators.forEach((collaborator) => {
  collaborator.consent = "approved";
  collaborator.consentAt = "2026-05-22";
  collaborator.profilePublic = true;
});
cleanProject.objects = [
  {
    id: "obj-manuscript",
    kind: "manuscript",
    title: "Accepted manuscript",
    permission: "read",
    labels: [],
    publicReady: true,
    ownerId: "user-owner"
  },
  {
    id: "obj-readme",
    kind: "readme",
    title: "Public project summary",
    permission: "read",
    labels: [],
    publicReady: true,
    ownerId: "user-owner"
  },
  {
    id: "obj-code",
    kind: "public-code",
    title: "Read-only analysis notebook",
    permission: "read",
    labels: [],
    publicReady: true,
    ownerId: "user-owner"
  }
];
cleanProject.holds = [];
cleanProject.externalAccess = [];
cleanProject.auditEvents = [
  { id: "audit-1", actorId: "user-owner", action: "visibility-requested", at: "2026-05-22T17:15:00Z" },
  { id: "audit-2", actorId: "user-steward", action: "object-reviewed", at: "2026-05-22T17:16:00Z" },
  { id: "audit-3", actorId: "user-admin", action: "institution-approved", at: "2026-05-22T17:18:00Z" },
  { id: "audit-4", actorId: "user-owner", action: "public-release-approved", at: "2026-05-22T17:20:00Z" }
];

const cleanPacket = buildReviewPacket(cleanProject);
assert.strictEqual(cleanPacket.decision, "visibility-transition-ready");
assert.strictEqual(cleanPacket.findings.length, 0);

const markdown = renderMarkdownReport(packet);
assert.ok(markdown.includes("## Findings"));
assert.ok(markdown.includes("sensitive-object-in-public-transition"));

const svg = renderSvgSummary(packet);
assert.ok(svg.includes("<svg"));
assert.ok(svg.includes("Project Visibility Transition Guard"));

console.log("project-visibility-transition-guard tests passed");

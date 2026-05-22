const assert = require("assert");
const { project } = require("./sample-data");
const {
  assignmentRiskReasons,
  buildReviewPacket,
  evaluateWorkloadEquity,
  renderMarkdownReport,
  renderSvgSummary
} = require("./index");

const evaluation = evaluateWorkloadEquity(project);
const packet = buildReviewPacket(project);

assert.strictEqual(packet.guard, "reviewer-workload-equity-guard");
assert.strictEqual(packet.issue, "SCIBASE-AI/SCIBASE.AI#15");
assert.strictEqual(packet.decision, "block-reputation-scoring-until-workload-is-fair");

assert.ok(
  evaluation.findings.some((finding) => finding.rule === "open-review-load-exceeded"),
  "expected open review load finding"
);
assert.ok(
  evaluation.findings.some((finding) => finding.rule === "weekly-review-hour-budget-exceeded"),
  "expected weekly hour budget finding"
);
assert.ok(
  evaluation.findings.some((finding) => finding.rule === "reviewer-unavailable-but-penalized"),
  "expected unavailable reviewer penalty finding"
);
assert.ok(
  evaluation.findings.some((finding) => finding.rule === "reviewer-opt-out-active"),
  "expected opt-out finding"
);
assert.ok(
  evaluation.findings.some((finding) => finding.rule === "review-credit-concentration-too-high"),
  "expected concentration finding"
);

const overloadedReviewer = project.reviewers.find((reviewer) => reviewer.id === "rev-001");
const overloadedAssignment = project.pendingAssignments.find((assignment) => assignment.id === "asg-105");
const reasons = assignmentRiskReasons(project, overloadedReviewer, overloadedAssignment);
assert.ok(reasons.includes("over_capacity"));
assert.ok(reasons.includes("weekly_hours_exceeded"));

const cleanProject = JSON.parse(JSON.stringify(project));
cleanProject.reviewers.forEach((reviewer) => {
  reviewer.availabilityStatus = "available";
  reviewer.weeklyCapacityHours = 14;
  reviewer.recentReviewHours = 1;
  reviewer.openReviewIds = [];
  reviewer.lastCompletedReviewAt = "2026-05-15";
  reviewer.optOutUntil = null;
  reviewer.unavailableWindows = [];
});
cleanProject.pendingAssignments = [
  {
    id: "asg-clean-1",
    reviewerId: "rev-001",
    topic: "data-curation",
    dueDate: "2026-05-29",
    estimatedHours: 2,
    status: "pending",
    reputationDelta: { completion: 5, decline: -1, late: -2 },
    affectsLeaderboard: false
  },
  {
    id: "asg-clean-2",
    reviewerId: "rev-002",
    topic: "statistics",
    dueDate: "2026-05-29",
    estimatedHours: 2,
    status: "pending",
    reputationDelta: { completion: 5, decline: -1, late: -2 },
    affectsLeaderboard: false
  },
  {
    id: "asg-clean-3",
    reviewerId: "rev-003",
    topic: "machine-learning",
    dueDate: "2026-05-29",
    estimatedHours: 2,
    status: "pending",
    reputationDelta: { completion: 5, decline: -1, late: -2 },
    affectsLeaderboard: false
  }
];
cleanProject.recentAssignmentHistory = [
  { id: "hist-clean-1", reviewerId: "rev-001", assignedAt: "2026-05-18", pointsAwarded: 3 },
  { id: "hist-clean-2", reviewerId: "rev-002", assignedAt: "2026-05-18", pointsAwarded: 3 },
  { id: "hist-clean-3", reviewerId: "rev-003", assignedAt: "2026-05-18", pointsAwarded: 3 }
];
cleanProject.policy.maxReviewerConcentrationRatio = 0.34;

const cleanPacket = buildReviewPacket(cleanProject);
assert.strictEqual(cleanPacket.decision, "workload-equity-ready");
assert.strictEqual(cleanPacket.findings.length, 0);

const markdown = renderMarkdownReport(packet);
assert.ok(markdown.includes("## Assignment Decisions"));
assert.ok(markdown.includes("suppress-negative-reputation-delta"));

const svg = renderSvgSummary(packet);
assert.ok(svg.includes("<svg"));
assert.ok(svg.includes("Reviewer Workload Equity Guard"));

console.log("reviewer-workload-equity-guard tests passed");

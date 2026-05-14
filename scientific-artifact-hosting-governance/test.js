const assert = require("assert");
const {
  buildArtifactManifest,
  detectArtifactType,
  diffArtifactVersions,
  evaluateArtifactHosting,
  metadataIdentifierType,
  validateRuntimeEnvironment,
} = require("./index");
const {previousDataset, project} = require("./sample-data");

function testTypeDetection() {
  assert.strictEqual(detectArtifactType({name: "measurements.csv"}), "dataset");
  assert.strictEqual(detectArtifactType({name: "analysis.ipynb"}), "notebook");
  assert.strictEqual(detectArtifactType({name: "workflow.py"}), "code");
  assert.strictEqual(detectArtifactType({name: "figure.svg"}), "figure");
  assert.strictEqual(detectArtifactType({name: "unknown.bin"}), "supplement");
}

function testManifestBuildsPreviewAndHashes() {
  const manifest = buildArtifactManifest(project);
  const dataset = manifest.find((artifact) => artifact.id === "artifact-cell-counts");
  const notebook = manifest.find((artifact) => artifact.id === "artifact-notebook");

  assert.strictEqual(manifest.length, 3);
  assert.strictEqual(dataset.type, "dataset");
  assert.strictEqual(dataset.preview.rowCount, 3);
  assert.deepStrictEqual(dataset.preview.columns, ["sample", "condition", "count"]);
  assert.strictEqual(dataset.metadataCheck.ok, true);
  assert.strictEqual(dataset.contentHash.length, 64);
  assert.strictEqual(notebook.preview.kind, "notebook");
}

function testMissingMetadataBlocksReadiness() {
  const incomplete = {
    ...project,
    artifacts: [
      {
        id: "artifact-bad",
        name: "bad.csv",
        content: "id,value\n1,2\n",
      },
    ],
  };
  const result = evaluateArtifactHosting(incomplete);

  assert.strictEqual(result.hostingReadiness, "blocked");
  assert(result.blockers.includes("artifact_metadata_incomplete:artifact-bad"));
}

function testVersionDiffs() {
  const diff = diffArtifactVersions(previousDataset, project.artifacts[0]);

  assert.strictEqual(diff.artifactId, "artifact-cell-counts");
  assert.strictEqual(diff.previousVersion, "1.0");
  assert.strictEqual(diff.currentVersion, "1.1");
  assert(diff.changes.includes("content_changed"));
}

function testRuntimeReadiness() {
  assert.strictEqual(validateRuntimeEnvironment(project.executionEnvironment).ok, true);
  assert.deepStrictEqual(validateRuntimeEnvironment({type: "docker"}).missing, ["image_or_definition_file", "commands"]);
}

function testFullEvaluationExportsMetadata() {
  const result = evaluateArtifactHosting(project);

  assert.strictEqual(result.hostingReadiness, "ready_for_review");
  assert(result.fairScore > 80);
  assert.strictEqual(result.jsonLd["@type"], "Dataset");
  assert.strictEqual(result.jsonLd.distribution.length, 3);
  assert.strictEqual(result.dataCite.relatedIdentifiers.length, 3);
  assert.strictEqual(result.dataCite.relatedIdentifiers[0].relatedIdentifierType, "DOI");
  assert.strictEqual(result.dataCite.relatedIdentifiers[1].relatedIdentifierType, "LocalId");
  assert.strictEqual(result.auditHash.length, 64);
}

function testMetadataIdentifierTypes() {
  assert.strictEqual(metadataIdentifierType("10.5555/scibase.artifact"), "DOI");
  assert.strictEqual(metadataIdentifierType("analysis.py"), "LocalId");
}

testTypeDetection();
testManifestBuildsPreviewAndHashes();
testMissingMetadataBlocksReadiness();
testVersionDiffs();
testRuntimeReadiness();
testFullEvaluationExportsMetadata();
testMetadataIdentifierTypes();

console.log("scientific-artifact-hosting-governance tests passed");

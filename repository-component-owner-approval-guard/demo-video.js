const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { componentPolicy, mergeRequests } = require("./sample-data");
const { evaluateRepositoryChanges } = require("./index");

const result = evaluateRepositoryChanges({
  mergeRequests,
  policy: componentPolicy
});

const reportDir = path.join(__dirname, "reports");
const outputPath = path.join(reportDir, "demo.webm");

const browserCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

function findBrowser() {
  const found = browserCandidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("Chrome or Edge was not found. Set CHROME_PATH to generate reports/demo.webm.");
  }
  return found;
}

function fileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/")}`;
}

const html = String.raw`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Repository component owner approval guard demo</title>
  <style>
    html, body { margin: 0; background: #f7f8fb; }
    canvas { width: 960px; height: 540px; }
    pre { white-space: pre-wrap; word-break: break-all; color: #f7f8fb; font-size: 1px; }
  </style>
</head>
<body>
  <canvas id="stage" width="960" height="540"></canvas>
  <pre id="out">recording</pre>
  <script>
    const canvas = document.getElementById("stage");
    const ctx = canvas.getContext("2d");
    const out = document.getElementById("out");
    const stats = ${JSON.stringify(result.summary)};
    const checks = [
      ["Component mapping", "Repository paths route to manuscript, data, code, notebooks, protocols, results, and metadata owners."],
      ["Owner quorum", "Protected merges require fresh eligible owner approval coverage for each touched component."],
      ["Restricted escalation", "Restricted data and protocol edits require privacy or IRB owner coverage."],
      ["Reviewer artifacts", "summary.json, reviewer-packet.md, summary.svg, and demo.webm are generated locally."]
    ];

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function draw(frame) {
      const t = frame / 52;
      ctx.fillStyle = "#f7f8fb";
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = "#111827";
      ctx.font = "bold 31px Arial";
      ctx.fillText("Repository Component Owner Approval Guard", 42, 60);
      ctx.font = "18px Arial";
      ctx.fillStyle = "#475569";
      ctx.fillText("SCIBASE #10 protected-branch quorum demo", 42, 92);

      ctx.fillStyle = "#e5e7eb";
      roundRect(42, 116, 876, 24, 8);
      ctx.fill();
      ctx.fillStyle = "#0f766e";
      roundRect(42, 116, 876 * Math.min(1, t), 24, 8);
      ctx.fill();

      checks.forEach(([title, text], index) => {
        const y = 172 + index * 67;
        const active = Math.floor(t * 4.4) >= index;
        ctx.fillStyle = active ? "#ffffff" : "#eef2f7";
        ctx.strokeStyle = active ? "#0f766e" : "#cbd5e1";
        ctx.lineWidth = active ? 3 : 1;
        roundRect(42, y, 876, 52, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = active ? "#0f766e" : "#64748b";
        ctx.font = "bold 18px Arial";
        ctx.fillText(title, 64, y + 21);
        ctx.fillStyle = "#334155";
        ctx.font = "15px Arial";
        ctx.fillText(text, 64, y + 42);
      });

      ctx.fillStyle = "#111827";
      ctx.font = "bold 22px Arial";
      ctx.fillText("Approved: " + stats.approved.length, 42, 480);
      ctx.fillStyle = "#b42318";
      ctx.fillText("Blocked: " + stats.blocked.length, 210, 480);
      ctx.fillStyle = "#64748b";
      ctx.font = "14px Arial";
      ctx.fillText("Synthetic data only. No Git provider, identity, storage, or external API calls.", 42, 516);
    }

    async function main() {
      if (!window.MediaRecorder) {
        out.textContent = "ERROR: MediaRecorder unavailable";
        return;
      }
      draw(0);
      const stream = canvas.captureStream(12);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          out.textContent = reader.result;
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      let frame = 0;
      const timer = setInterval(() => {
        draw(frame);
        frame += 1;
        if (frame >= 52) {
          clearInterval(timer);
          recorder.stop();
          stream.getTracks().forEach((track) => track.stop());
        }
      }, 83);
    }

    main();
  </script>
</body>
</html>`;

fs.mkdirSync(reportDir, { recursive: true });

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "repository-owner-demo-"));
const htmlPath = path.join(tempDir, "demo.html");
const profileDir = path.join(tempDir, "profile");
fs.writeFileSync(htmlPath, html, "utf8");

const stdout = execFileSync(
  findBrowser(),
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--autoplay-policy=no-user-gesture-required",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=7500",
    `--user-data-dir=${profileDir}`,
    "--dump-dom",
    fileUrl(htmlPath)
  ],
  { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 }
);

const match = stdout.match(/data:video\/webm;base64,([A-Za-z0-9+/=]+)/);
if (!match) {
  throw new Error(`Demo video generation failed. Browser output ended with: ${stdout.slice(-600)}`);
}

fs.writeFileSync(outputPath, Buffer.from(match[1], "base64"));
console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);
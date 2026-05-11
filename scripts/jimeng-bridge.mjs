#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = parseInt(process.env.JIMENG_BRIDGE_PORT || "18765", 10);
const DREAMINA_BIN = process.env.DREAMINA_BIN || "D:\\work\\dreamina.exe";
const WORK_DIR = process.env.JIMENG_BRIDGE_WORKDIR || path.resolve(process.cwd(), "data", "jimeng_bridge");

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
}

function parseSubmitId(text) {
  const content = stripAnsi(text);
  const byKey = content.match(/submit_id\s*[:=]\s*([0-9a-fA-F-]{12,})/i);
  if (byKey) return byKey[1];
  const byUuid = content.match(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/);
  return byUuid ? byUuid[0] : "";
}

function parseGenStatus(text) {
  const content = stripAnsi(text);
  const byKey = content.match(/gen_status\s*[:=]\s*(success|fail|querying)/i);
  if (byKey) return byKey[1].toLowerCase();
  if (/AigcComplianceConfirmationRequired/i.test(content)) return "fail";
  if (/等待登录超时|未检测到有效登录态|请先执行 dreamina login/i.test(content)) return "fail";
  if (/\bsuccess\b/i.test(content)) return "success";
  if (/\bfail(ed)?\b/i.test(content)) return "fail";
  if (/querying|processing|pending|生成中/i.test(content)) return "querying";
  return "";
}

function parseHttpVideoUrl(text) {
  const content = stripAnsi(text);
  const m = content.match(/https?:\/\/[^\s"'`]+?\.(mp4|mov|webm|m4v)(\?[^\s"'`]*)?/i);
  return m ? m[0] : "";
}

async function runDreamina(args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const child = spawn(DREAMINA_BIN, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, output: `${stdout}\n${stderr}`.trim() });
    });
  });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeBase64ToFile(base64, filePath) {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
  await fs.writeFile(filePath, Buffer.from(cleaned, "base64"));
}

async function listFilesRecursive(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const item of items) {
    const abs = path.join(dir, item.name);
    if (item.isDirectory()) {
      out.push(...(await listFilesRecursive(abs)));
    } else {
      out.push(abs);
    }
  }
  return out;
}

async function pickNewestVideoFile(dir) {
  const files = await listFilesRecursive(dir);
  const videoExt = new Set([".mp4", ".mov", ".webm", ".m4v"]);
  const candidates = [];
  for (const file of files) {
    if (!videoExt.has(path.extname(file).toLowerCase())) continue;
    const st = await fs.stat(file);
    candidates.push({ file, mtimeMs: st.mtimeMs });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.file || "";
}

function toDataUri(buffer, ext) {
  const mimeMap = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".m4v": "video/x-m4v",
  };
  const mime = mimeMap[ext.toLowerCase()] || "video/mp4";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function maybeDownloadFromUrl(videoUrl) {
  const resp = await fetch(videoUrl);
  if (!resp.ok) throw new Error(`下载视频失败: HTTP ${resp.status}`);
  const arr = await resp.arrayBuffer();
  const buf = Buffer.from(arr);
  const ext = path.extname(new URL(videoUrl).pathname) || ".mp4";
  return { dataUri: toDataUri(buf, ext), bytes: buf.length };
}

async function queryUntilReady(submitId, taskDir, pollIntervalSec, timeoutSec) {
  const started = Date.now();
  const timeoutMs = timeoutSec * 1000;
  while (Date.now() - started < timeoutMs) {
    const result = await runDreamina(
      ["query_result", `--submit_id=${submitId}`, `--download_dir=${taskDir}`],
      Math.max(120000, pollIntervalSec * 1000 + 60000),
    );
    const output = result.output || "";
    if (result.code !== 0) {
      if (/未检测到有效登录态|请先执行 dreamina login/i.test(output)) {
        throw new Error("即梦登录态无效，请先执行 dreamina login");
      }
      if (/submit_id.*不存在|not found|无效/i.test(output)) {
        await sleep(pollIntervalSec * 1000);
        continue;
      }
    }

    const status = parseGenStatus(output);
    if (status === "fail") {
      if (/AigcComplianceConfirmationRequired/i.test(output)) {
        throw new Error("AigcComplianceConfirmationRequired：请先在即梦 Web 端完成授权确认后重试");
      }
      throw new Error(output || "即梦任务失败");
    }

    const file = await pickNewestVideoFile(taskDir);
    if (file) {
      const ext = path.extname(file);
      const buf = await fs.readFile(file);
      return { status: "success", base64: toDataUri(buf, ext), submitId, source: "download_dir" };
    }

    const url = parseHttpVideoUrl(output);
    if (url) {
      const downloaded = await maybeDownloadFromUrl(url);
      return { status: "success", base64: downloaded.dataUri, submitId, source: "url" };
    }

    await sleep(Math.max(1, pollIntervalSec) * 1000);
  }
  throw new Error(`查询超时：submit_id=${submitId}`);
}

async function handleGenerate(payload) {
  const prompt = String(payload.prompt || "").trim();
  if (!prompt) throw new Error("缺少 prompt");

  const images = Array.isArray(payload.images) ? payload.images.filter(Boolean) : [];
  const duration = Number(payload.duration || 5);
  const ratio = String(payload.ratio || "9:16");
  const videoResolution = String(payload.video_resolution || "720p");
  const modelVersion = String(payload.model_version || "seedance2.0fast");
  const session = Number(payload.session || 0);
  const pollIntervalSec = Math.max(1, Number(payload.poll_interval_sec || 5));
  const timeoutSec = Math.max(30, Number(payload.timeout_sec || 600));

  const taskId = randomUUID();
  const taskDir = path.join(WORK_DIR, taskId);
  const inputDir = path.join(taskDir, "input");
  await ensureDir(inputDir);

  const imagePaths = [];
  for (let i = 0; i < images.length; i += 1) {
    const file = path.join(inputDir, `ref_${i + 1}.png`);
    await writeBase64ToFile(String(images[i]), file);
    imagePaths.push(file);
  }

  let args = [];
  if (imagePaths.length === 0) {
    args = [
      "text2video",
      `--prompt=${prompt}`,
      `--duration=${duration}`,
      `--ratio=${ratio}`,
      `--video_resolution=${videoResolution}`,
      `--model_version=${modelVersion}`,
      `--session=${session}`,
      "--poll=0",
    ];
  } else if (imagePaths.length === 1) {
    args = [
      "image2video",
      `--image=${imagePaths[0]}`,
      `--prompt=${prompt}`,
      `--duration=${duration}`,
      `--video_resolution=${videoResolution}`,
      `--model_version=${modelVersion}`,
      `--session=${session}`,
      "--poll=0",
    ];
  } else {
    const imageArg = imagePaths.join(",");
    args = [
      "multiframe2video",
      "--images",
      imageArg,
      `--prompt=${prompt}`,
      `--session=${session}`,
      "--poll=0",
    ];
  }

  const submit = await runDreamina(args, 240000);
  const submitOutput = submit.output || "";
  if (submit.code !== 0) {
    if (/未检测到有效登录态|请先执行 dreamina login/i.test(submitOutput)) {
      throw new Error("即梦登录态无效，请先执行 dreamina login");
    }
    throw new Error(submitOutput || "即梦提交失败");
  }

  if (/AigcComplianceConfirmationRequired/i.test(submitOutput)) {
    throw new Error("AigcComplianceConfirmationRequired：请先在即梦 Web 端完成授权确认后重试");
  }

  const submitId = parseSubmitId(submitOutput);
  if (!submitId) {
    const maybeUrl = parseHttpVideoUrl(submitOutput);
    if (maybeUrl) {
      const downloaded = await maybeDownloadFromUrl(maybeUrl);
      return {
        ok: true,
        submit_id: "",
        gen_status: "success",
        base64: downloaded.dataUri,
        source: "submit_url",
      };
    }
    throw new Error(`无法从即梦返回中解析 submit_id。\n${submitOutput}`);
  }

  const finalResult = await queryUntilReady(submitId, taskDir, pollIntervalSec, timeoutSec);
  return {
    ok: true,
    submit_id: finalResult.submitId,
    gen_status: finalResult.status,
    base64: finalResult.base64,
    source: finalResult.source,
  };
}

async function main() {
  await ensureDir(WORK_DIR);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
      if (req.method === "GET" && url.pathname === "/health") {
        let cliExists = false;
        try {
          await fs.access(DREAMINA_BIN);
          cliExists = true;
        } catch {
          cliExists = false;
        }
        return json(res, 200, { ok: true, bridge: "jimeng", dreamina_bin: DREAMINA_BIN, dreamina_exists: cliExists, work_dir: WORK_DIR });
      }

      if (req.method === "POST" && url.pathname === "/v1/video/generate") {
        const payload = await readJsonBody(req);
        const result = await handleGenerate(payload);
        return json(res, 200, result);
      }

      return json(res, 404, { ok: false, error: "not found" });
    } catch (err) {
      return json(res, 500, { ok: false, error: err?.message || String(err) });
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[jimeng-bridge] listening at http://127.0.0.1:${PORT}`);
    console.log(`[jimeng-bridge] dreamina bin: ${DREAMINA_BIN}`);
    console.log(`[jimeng-bridge] work dir: ${WORK_DIR}`);
  });
}

main().catch((err) => {
  console.error("[jimeng-bridge] fatal:", err);
  process.exit(1);
});


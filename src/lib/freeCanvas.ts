import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import u from "@/utils";

export interface FreeCanvasData {
  nodes: any[];
  edges: any[];
  viewport?: { x: number; y: number; zoom: number };
  updatedAt?: number;
  [key: string]: any;
}

const MEDIA_KEY_RE = /(url|src|image|video|audio|panorama|screenshot|reference|output|file)/i;

function isDataUrl(value: string) {
  return /^data:[^;]+;base64,/.test(value);
}

function isOssLikeUrl(value: string) {
  if (!value || isDataUrl(value)) return false;
  if (value.startsWith("/oss/")) return true;
  try {
    return new URL(value).pathname.startsWith("/oss/");
  } catch {
    return value.startsWith("/");
  }
}

async function restoreMediaUrl(value: string) {
  if (!value || isDataUrl(value) || /^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return await u.oss.getFileUrl(value);
  return value;
}

export function stripCanvasMediaUrls<T>(value: T): T {
  const visit = (current: any, key = ""): any => {
    if (typeof current === "string") {
      return MEDIA_KEY_RE.test(key) && isOssLikeUrl(current) ? u.replaceUrl(current) : current;
    }
    if (Array.isArray(current)) return current.map((item) => visit(item, key));
    if (current && typeof current === "object") {
      return Object.fromEntries(Object.entries(current).map(([childKey, childValue]) => [childKey, visit(childValue, childKey)]));
    }
    return current;
  };
  return visit(value);
}

export async function restoreCanvasMediaUrls<T>(value: T): Promise<T> {
  const visit = async (current: any, key = ""): Promise<any> => {
    if (typeof current === "string") {
      return MEDIA_KEY_RE.test(key) ? await restoreMediaUrl(current) : current;
    }
    if (Array.isArray(current)) return await Promise.all(current.map((item) => visit(item, key)));
    if (current && typeof current === "object") {
      const pairs = await Promise.all(Object.entries(current).map(async ([childKey, childValue]) => [childKey, await visit(childValue, childKey)]));
      return Object.fromEntries(pairs);
    }
    return current;
  };
  return await visit(value);
}

export async function readAgentWorkData(projectId: number, scriptId: number): Promise<Record<string, any>> {
  const row = await u
    .db("o_agentWorkData")
    .where("projectId", String(projectId))
    .andWhere("episodesId", String(scriptId))
    .where("key", "productionAgent")
    .first();

  if (!row?.data) return {};
  try {
    return JSON.parse(row.data);
  } catch {
    return {};
  }
}

export async function writeAgentWorkData(projectId: number, scriptId: number, data: Record<string, any>) {
  const now = Date.now();
  const row = await u
    .db("o_agentWorkData")
    .where("projectId", String(projectId))
    .andWhere("episodesId", String(scriptId))
    .where("key", "productionAgent")
    .first();

  const payload = {
    projectId,
    episodesId: scriptId,
    key: "productionAgent",
    data: JSON.stringify(data),
    updateTime: now,
  };

  if (!row) {
    await u.db("o_agentWorkData").insert({ ...payload, createTime: now });
    return;
  }

  await u
    .db("o_agentWorkData")
    .where("projectId", String(projectId))
    .andWhere("episodesId", String(scriptId))
    .where("key", "productionAgent")
    .update(payload);
}

export async function getFreeCanvas(projectId: number, scriptId: number): Promise<FreeCanvasData> {
  const data = await readAgentWorkData(projectId, scriptId);
  const canvas = data.freeCanvas ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, updatedAt: 0 };
  return await restoreCanvasMediaUrls(canvas);
}

export async function saveFreeCanvas(projectId: number, scriptId: number, canvas: FreeCanvasData) {
  const data = await readAgentWorkData(projectId, scriptId);
  const normalized = stripCanvasMediaUrls({
    nodes: Array.isArray(canvas.nodes) ? canvas.nodes : [],
    edges: Array.isArray(canvas.edges) ? canvas.edges : [],
    viewport: canvas.viewport ?? { x: 0, y: 0, zoom: 1 },
    updatedAt: Date.now(),
    meta: canvas.meta ?? {},
  });
  data.freeCanvas = normalized;
  await writeAgentWorkData(projectId, scriptId, data);
  return await restoreCanvasMediaUrls(normalized);
}

export async function urlToBase64(input: string): Promise<string> {
  if (!input) return "";
  if (isDataUrl(input)) return input;
  if (input.startsWith("/oss/") || input.startsWith("/")) {
    return await u.oss.getImageBase64(u.replaceUrl(input));
  }
  const response = await axios.get(input, { responseType: "arraybuffer" });
  const contentType = response.headers["content-type"] || "image/png";
  const base64 = Buffer.from(response.data, "binary").toString("base64");
  return `data:${contentType};base64,${base64}`;
}

export function getBase64Ext(base64Data: string): { ext: string; kind: "image" | "video" | "audio" | "file" } {
  const mime = base64Data.match(/^data:([^;]+);base64,/)?.[1] ?? "";
  const map: Record<string, { ext: string; kind: "image" | "video" | "audio" | "file" }> = {
    "image/jpeg": { ext: "jpg", kind: "image" },
    "image/jpg": { ext: "jpg", kind: "image" },
    "image/png": { ext: "png", kind: "image" },
    "image/webp": { ext: "webp", kind: "image" },
    "image/gif": { ext: "gif", kind: "image" },
    "video/mp4": { ext: "mp4", kind: "video" },
    "video/webm": { ext: "webm", kind: "video" },
    "audio/mpeg": { ext: "mp3", kind: "audio" },
    "audio/mp3": { ext: "mp3", kind: "audio" },
    "audio/wav": { ext: "wav", kind: "audio" },
  };
  return map[mime] ?? { ext: "bin", kind: "file" };
}

export async function saveBase64ToFreeCanvas(projectId: number, scriptId: number, base64Data: string) {
  const { ext, kind } = getBase64Ext(base64Data);
  if (kind === "file") throw new Error("Unsupported file type");
  const savePath = `/${projectId}/freeCanvas/${scriptId}/${uuidv4()}.${ext}`;
  await u.oss.writeFile(savePath, base64Data);
  return {
    url: await u.oss.getFileUrl(savePath),
    filePath: savePath,
    kind,
  };
}

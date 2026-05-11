/**
 * RunningHub AI app adapter.
 * API docs: https://www.runninghub.cn/runninghub-api-doc-cn/
 * @version 2.1
 */

type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[];

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType?: "base64"; base64: string }
  | { type: "audio"; sourceType?: "base64"; base64: string }
  | { type: "video"; sourceType?: "base64"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
  referenceList?: Extract<ReferenceList, { type: "audio" }>[];
}

interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}

declare const axios: any;
declare const Buffer: any;
declare const FormData: any;
declare const logger: (msg: string) => void;
declare const jsonwebtoken: any;
declare const zipImage: (base64: string, size: number) => Promise<string>;
declare const zipImageResolution: (base64: string, w: number, h: number) => Promise<string>;
declare const mergeImages: (base64Arr: string[], maxSize?: string) => Promise<string>;
declare const urlToBase64: (url: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>;
declare const createOpenAI: any;
declare const createDeepSeek: any;
declare const createZhipu: any;
declare const createQwen: any;
declare const createAnthropic: any;
declare const createOpenAICompatible: any;
declare const createXai: any;
declare const createMinimax: any;
declare const createGoogleGenerativeAI: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};

const workflowMap: Record<
  string,
  {
    webappId: string;
    nodeId: string;
    fieldName: string;
    outputType: "image" | "video";
    timeoutSec: number;
  }
> = {
  rh_asset_batch: { webappId: "2005959329352216578", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_character_16view: { webappId: "2013972792064086017", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_scene_multiview: { webappId: "1996404581909282817", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_anima_text2image: { webappId: "2018210962876141569", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_image_pro_multiref: { webappId: "2014810511157764097", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_storyboard_fast: { webappId: "2005605055329959937", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_storyboard_allround: { webappId: "2022578281073090562", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_storyboard_anime_9: { webappId: "2020428662109118466", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_storyboard_seedance25: { webappId: "2025561016783867906", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_storyboard_ref4: { webappId: "2027630151592316929", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_lineart_extract: { webappId: "1914565903457972226", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_watermark_remove_image: { webappId: "1939683977558925314", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_colored_pencil: { webappId: "1945126036868669442", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_black_white_line: { webappId: "1945396941478088706", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_background_replace: { webappId: "1994230350398373889", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_movie_poster: { webappId: "2015061306050617345", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_vr_panorama: { webappId: "2035653343107883009", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_role_card_budget: { webappId: "2047931267416596482", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_prop_budget: { webappId: "2047936094703984642", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_scene_budget: { webappId: "2047940968673976322", nodeId: "115", fieldName: "text", outputType: "image", timeoutSec: 300 },
  rh_video_upscale_interpolate: { webappId: "1903013826319519745", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 600 },
  rh_i2v_advanced: { webappId: "2005940928315617281", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 600 },
  rh_multishot_video: { webappId: "2007342454793572354", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 600 },
  rh_wan22_start_end: { webappId: "2008216677007233026", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 600 },
  rh_wan22_15s: { webappId: "1960264745792253953", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 900 },
  rh_ltx23_auto_video: { webappId: "2029982966985789442", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 900 },
  rh_ltx23_start_end: { webappId: "2033170815587459073", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 900 },
  rh_seedance20_r2v: { webappId: "2034004703876489218", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 900 },
  rh_universal_video: { webappId: "2028770613413814273", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 900 },
  rh_audio_visual_lipsync: { webappId: "2017635964469907457", nodeId: "115", fieldName: "text", outputType: "video", timeoutSec: 900 },
};

const vendor: VendorConfig = {
  id: "runninghub",
  version: "2.1",
  author: "Codex",
  name: "RunningHub",
  description: "RunningHub AI app adapter. Uses /task/openapi/ai-app/run and /openapi/v2/query.",
  icon: "",
  inputs: [
    { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "RunningHub API Key" },
    { key: "baseUrl", label: "Base URL", type: "url", required: false, placeholder: "https://www.runninghub.cn" },
    { key: "webappId", label: "Override WebApp ID", type: "text", required: false, placeholder: "Leave empty to use the selected model WebApp ID" },
    { key: "nodeId", label: "Fallback Node ID", type: "text", required: false, placeholder: "Used only when demo nodeInfoList cannot be fetched" },
    { key: "fieldName", label: "Fallback Field Name", type: "text", required: false, placeholder: "Used only when demo nodeInfoList cannot be fetched" },
    { key: "nodeInfoList", label: "nodeInfoList JSON", type: "text", required: false, placeholder: "Optional custom nodeInfoList JSON array" },
    { key: "instanceType", label: "Instance Type", type: "text", required: false, placeholder: "Optional, e.g. plus" },
    { key: "timeoutSec", label: "Timeout Seconds", type: "text", required: false, placeholder: "Image 300, video 600-900" },
    { key: "maxConcurrency", label: "Max Concurrency", type: "text", required: false, placeholder: "For record only" },
    { key: "workflowId", label: "Workflow ID", type: "text", required: false, placeholder: "For record only; API apps need WebApp ID" },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://www.runninghub.cn",
    webappId: "",
    nodeId: "",
    fieldName: "",
    nodeInfoList: "",
    instanceType: "",
    timeoutSec: "",
    maxConcurrency: "3",
    workflowId: "",
  },
  models: [
    { name: "P0 资产批量创建 | 2005959329352216578", modelName: "rh_asset_batch", type: "image", mode: ["text"] },
    { name: "角色16视图一致性生成 | 2013972792064086017", modelName: "rh_character_16view", type: "image", mode: ["text", "singleImage"] },
    { name: "场景多视角生成 | 1996404581909282817", modelName: "rh_scene_multiview", type: "image", mode: ["text", "singleImage"] },
    { name: "Anima 动漫图像文生图 | 2018210962876141569", modelName: "rh_anima_text2image", type: "image", mode: ["text"] },
    { name: "全能图片 Pro 多图参考 | 2014810511157764097", modelName: "rh_image_pro_multiref", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "P1 短剧漫画分镜快速版 | 2005605055329959937", modelName: "rh_storyboard_fast", type: "image", mode: ["text", "singleImage"] },
    { name: "全能图片短剧漫画主体场景分镜 | 2022578281073090562", modelName: "rh_storyboard_allround", type: "image", mode: ["text", "singleImage"] },
    { name: "AI 动漫短剧分镜图 9 张自动工作流 | 2020428662109118466", modelName: "rh_storyboard_anime_9", type: "image", mode: ["text"] },
    { name: "Seedance 2.0 配套 5 分镜图含提示词 | 2025561016783867906", modelName: "rh_storyboard_seedance25", type: "image", mode: ["text"] },
    { name: "全能图片 Pro 参考图生成分镜 | 2027630151592316929", modelName: "rh_storyboard_ref4", type: "image", mode: ["text", "singleImage"] },
    { name: "最强线稿提取 | 1914565903457972226", modelName: "rh_lineart_extract", type: "image", mode: ["text", "singleImage"] },
    { name: "极速图片水印文字去除 | 1939683977558925314", modelName: "rh_watermark_remove_image", type: "image", mode: ["text", "singleImage"] },
    { name: "彩铅线条插画风 | 1945126036868669442", modelName: "rh_colored_pencil", type: "image", mode: ["text", "singleImage"] },
    { name: "黑白线条风格 | 1945396941478088706", modelName: "rh_black_white_line", type: "image", mode: ["text", "singleImage"] },
    { name: "换背景/背景替换/视频换背景 | 1994230350398373889", modelName: "rh_background_replace", type: "image", mode: ["text", "singleImage"] },
    { name: "AI 电影海报速成大师 | 2015061306050617345", modelName: "rh_movie_poster", type: "image", mode: ["text", "singleImage"] },
    { name: "360 度 VR 全景图 | 2035653343107883009", modelName: "rh_vr_panorama", type: "image", mode: ["text"] },
    { name: "角色生成卡 0.1元/次 | 2047931267416596482", modelName: "rh_role_card_budget", type: "image", mode: ["text", "singleImage"] },
    { name: "道具生成 0.1元/次 | 2047936094703984642", modelName: "rh_prop_budget", type: "image", mode: ["text", "singleImage"] },
    { name: "场景生成 0.1元/次 | 2047940968673976322", modelName: "rh_scene_budget", type: "image", mode: ["text", "singleImage"] },
    {
      name: "1080p 视频高清放大补帧 V2.0 | 1903013826319519745",
      modelName: "rh_video_upscale_interpolate",
      type: "video",
      mode: ["text", "singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [5], resolution: ["1080p"] }],
    },
    {
      name: "P2 图生视频进阶优化版 | 2005940928315617281",
      modelName: "rh_i2v_advanced",
      type: "video",
      mode: ["singleImage", "text"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p", "1080p"] }],
    },
    {
      name: "多分镜视频生成 | 2007342454793572354",
      modelName: "rh_multishot_video",
      type: "video",
      mode: ["text", ["imageReference:4"]],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p", "1080p"] }],
    },
    {
      name: "Wan2.2 首尾帧视频扩写动漫 | 2008216677007233026",
      modelName: "rh_wan22_start_end",
      type: "video",
      mode: ["startEndRequired", "text"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p", "1080p"] }],
    },
    {
      name: "Fish-Wan2.2-AIO 15 秒连续长视频 | 1960264745792253953",
      modelName: "rh_wan22_15s",
      type: "video",
      mode: ["startEndRequired", "singleImage", "text"],
      audio: false,
      durationResolutionMap: [{ duration: [15], resolution: ["720p", "1080p"] }],
    },
    {
      name: "LTX2.3 全自动图生/文生视频 | 2029982966985789442",
      modelName: "rh_ltx23_auto_video",
      type: "video",
      mode: ["text", "singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p", "1080p"] }],
    },
    {
      name: "LTX2.3 双图首尾帧优化版 | 2033170815587459073",
      modelName: "rh_ltx23_start_end",
      type: "video",
      mode: ["startEndRequired", "text"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p", "1080p"] }],
    },
    {
      name: "Seedance 2.0 多图参考 R2V 视频生成 | 2034004703876489218",
      modelName: "rh_seedance20_r2v",
      type: "video",
      mode: ["text", ["imageReference:4"]],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p", "1080p"] }],
    },
    {
      name: "全自动万能视频生成器 | 2028770613413814273",
      modelName: "rh_universal_video",
      type: "video",
      mode: ["text", "singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p", "1080p"] }],
    },
    {
      name: "图音生视频高动态音画口型一条龙 | 2017635964469907457",
      modelName: "rh_audio_visual_lipsync",
      type: "video",
      mode: ["text", ["imageReference:1", "audioReference:1"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [5, 10], resolution: ["720p", "1080p"] }],
    },
  ],
};

function getWorkflow(modelName: string, expectedType: "image" | "video") {
  const workflow = workflowMap[modelName];
  if (!workflow) throw new Error(`RunningHub workflow not found: ${modelName}`);
  if (workflow.outputType !== expectedType) throw new Error(`RunningHub workflow type mismatch: ${modelName}`);
  return workflow;
}

function getPromptNode(modelName: string, expectedType: "image" | "video") {
  const workflow = getWorkflow(modelName, expectedType);
  return {
    webappId: vendor.inputValues.webappId || workflow.webappId,
    nodeId: vendor.inputValues.nodeId || workflow.nodeId,
    fieldName: vendor.inputValues.fieldName || workflow.fieldName,
    timeoutSec: Math.max(30, Number(vendor.inputValues.timeoutSec || workflow.timeoutSec)),
  };
}

function getApiKey() {
  return (vendor.inputValues.apiKey || "").replace(/^Bearer\s+/i, "").trim();
}

function getApiRoot() {
  const raw = (vendor.inputValues.baseUrl || "https://www.runninghub.cn").trim().replace(/\/+$/, "");
  return raw.replace(/\/api$/, "").replace(/\/task\/openapi\/ai-app\/run$/, "").replace(/\/openapi\/v2\/query$/, "");
}

function getHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function assertSuccess(data: any, action: string) {
  if (typeof data?.code === "number" && data.code !== 0) {
    throw new Error(`RunningHub ${action} failed: ${data.msg || data.message || data.errorMessage || data.errorCode || data.code}`);
  }
}

function parseDemoCurl(curl: string) {
  const marker = "--data-raw";
  const markerIndex = curl.indexOf(marker);
  if (markerIndex < 0) return null;
  const bodyStart = curl.indexOf("{", markerIndex);
  const bodyEnd = curl.lastIndexOf("}");
  if (bodyStart < 0 || bodyEnd <= bodyStart) return null;
  return JSON.parse(curl.slice(bodyStart, bodyEnd + 1));
}

function isPromptNode(item: any) {
  const fieldName = String(item?.fieldName || "").toLowerCase();
  const description = String(item?.description || "").toLowerCase();
  return ["prompt", "text", "positive", "caption", "query", "content", "input"].includes(fieldName) || /prompt|text|提示|文本|描述/.test(description);
}

function applyPromptToNodeInfoList(nodeInfoList: any[], prompt: string) {
  const list = JSON.parse(JSON.stringify(nodeInfoList));
  let changed = false;
  for (const item of list) {
    if (isPromptNode(item)) {
      item.fieldValue = prompt;
      changed = true;
    }
  }
  if (!changed && list.length > 0) list[0].fieldValue = prompt;
  return list;
}

function isImageNode(item: any) {
  const fieldName = String(item?.fieldName || "").toLowerCase();
  const fieldType = String(item?.fieldType || "").toLowerCase();
  const description = String(item?.description || "").toLowerCase();
  return fieldType === "image" || fieldName === "image" || /loadimage|image|图片|图像/.test(description);
}

function pickUploadedFileName(data: any): string {
  const candidates = [
    data?.data?.fileName,
    data?.data?.filename,
    data?.data?.file_name,
    data?.data?.name,
    data?.fileName,
    data?.filename,
    data?.file_name,
    data?.name,
  ].filter(Boolean);
  return candidates.length ? String(candidates[0]) : "";
}

function base64ToUploadPart(base64: string) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(base64);
  const mime = match?.[1] || "image/png";
  const raw = match?.[2] || base64;
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "png";
  return {
    buffer: Buffer.from(raw, "base64"),
    filename: `toonflow-reference-${Date.now()}.${ext}`,
    contentType: mime,
  };
}

async function uploadImageReference(apiRoot: string, apiKey: string, base64: string): Promise<string> {
  const part = base64ToUploadPart(base64);
  const form = new FormData();
  form.append("apiKey", apiKey);
  form.append("file", part.buffer, { filename: part.filename, contentType: part.contentType });
  const uploadUrls = [`${apiRoot}/task/openapi/upload`, `${apiRoot}/api/openapi/upload`, `${apiRoot}/openapi/upload`];
  let lastError: any = null;
  for (const url of uploadUrls) {
    try {
      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      });
      assertSuccess(response?.data, "upload file");
      const fileName = pickUploadedFileName(response?.data);
      if (!fileName) throw new Error(`RunningHub upload file failed: missing fileName`);
      return fileName;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function applyReferencesToNodeInfoList(apiRoot: string, apiKey: string, nodeInfoList: any[], references?: ReferenceList[]) {
  const imageRefs = (references || []).filter((ref) => ref.type === "image");
  if (!imageRefs.length) return nodeInfoList;

  const list = JSON.parse(JSON.stringify(nodeInfoList));
  const imageNodes = list.filter(isImageNode);
  if (!imageNodes.length) {
    throw new Error("RunningHub workflow needs an image input node, but no IMAGE node was found in nodeInfoList");
  }

  for (let i = 0; i < imageNodes.length && i < imageRefs.length; i++) {
    imageNodes[i].fieldValue = await uploadImageReference(apiRoot, apiKey, imageRefs[i].base64);
  }
  return list;
}

async function getNodeInfoList(apiRoot: string, apiKey: string, webappId: string, prompt: string, nodeId: string, fieldName: string) {
  if (vendor.inputValues.nodeInfoList) {
    return applyPromptToNodeInfoList(JSON.parse(vendor.inputValues.nodeInfoList), prompt);
  }

  try {
    const demoResponse = await axios.get(`${apiRoot}/api/webapp/apiCallDemo`, {
      params: { apiKey, webappId },
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 30000,
    });
    assertSuccess(demoResponse?.data, "get AI app demo");
    const demoData = demoResponse?.data?.data || demoResponse?.data;
    const demoPayload = demoData?.nodeInfoList ? demoData : demoData?.curl ? parseDemoCurl(demoData.curl) : null;
    if (demoPayload?.nodeInfoList?.length) return applyPromptToNodeInfoList(demoPayload.nodeInfoList, prompt);
  } catch (err) {
    logger?.(`RunningHub demo nodeInfoList fallback: ${err instanceof Error ? err.message : String(err)}`);
  }

  return [{ nodeId, fieldName, fieldValue: prompt }];
}

function pickFileUrl(data: any): string {
  const candidates = [
    data?.fileUrl,
    data?.fileURL,
    data?.url,
    data?.outputUrl,
    data?.resultUrl,
    data?.files?.[0],
    data?.fileList?.[0]?.fileUrl,
    data?.fileList?.[0]?.url,
    data?.outputs?.[0]?.fileUrl,
    data?.outputs?.[0]?.url,
    data?.results?.[0]?.url,
    data?.results?.[0]?.fileUrl,
  ].filter(Boolean);
  return candidates.length ? String(candidates[0]) : "";
}

async function runRunningHubTask(prompt: string, modelName: string, expectedType: "image" | "video", references?: ReferenceList[]): Promise<string> {
  const apiKey = getApiKey();
  const apiRoot = getApiRoot();
  if (!apiKey) throw new Error("RunningHub API Key is required");

  const { webappId, nodeId, fieldName, timeoutSec } = getPromptNode(modelName, expectedType);
  if (!webappId) throw new Error("RunningHub WebApp ID is required");

  const nodeInfoList = await applyReferencesToNodeInfoList(
    apiRoot,
    apiKey,
    await getNodeInfoList(apiRoot, apiKey, webappId, prompt, nodeId, fieldName),
    references,
  );
  const submitPayload: any = { apiKey, webappId, nodeInfoList };
  if (vendor.inputValues.instanceType) submitPayload.instanceType = vendor.inputValues.instanceType;

  const submitResponse = await axios.post(`${apiRoot}/task/openapi/ai-app/run`, submitPayload, {
    headers: getHeaders(apiKey),
    timeout: 60000,
  });
  assertSuccess(submitResponse?.data, "submit task");

  const taskId = submitResponse?.data?.data?.taskId || submitResponse?.data?.taskId;
  if (!taskId) throw new Error(`RunningHub submit task failed: ${submitResponse?.data?.msg || submitResponse?.data?.message || "missing taskId"}`);

  const pollResult = await pollTask(async () => {
    const detailResponse = await axios.post(
      `${apiRoot}/openapi/v2/query`,
      { taskId },
      { headers: getHeaders(apiKey), timeout: 30000 },
    );
    assertSuccess(detailResponse?.data, "query task");

    const taskData = detailResponse?.data?.data || detailResponse?.data;
    const status = String(taskData?.taskStatus || taskData?.status || "").toUpperCase();
    if (["SUCCESS", "SUCCEEDED", "COMPLETED", "FINISHED"].includes(status)) {
      const fileUrl = pickFileUrl(taskData);
      if (!fileUrl) return { completed: true, error: `RunningHub task succeeded but no output URL was returned: ${taskId}` };
      return { completed: true, data: fileUrl };
    }
    if (["FAILURE", "FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) {
      return { completed: true, error: `RunningHub task failed: ${taskData?.errorMessage || taskData?.msg || taskData?.message || taskId}` };
    }
    return { completed: false };
  }, 3000, timeoutSec * 1000);

  if (pollResult.error) throw new Error(pollResult.error === "timeout" ? `RunningHub task query timed out: ${taskId}` : pollResult.error);
  if (!pollResult.data) throw new Error(`RunningHub task query returned no output URL: ${taskId}`);
  return await urlToBase64(pollResult.data);
}

const textRequest = () => {
  throw new Error("RunningHub does not support text models in Toonflow. Please select an image or video model.");
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  if (["rh_colored_pencil", "rh_lineart_extract", "rh_black_white_line"].includes(model.modelName) && !config.referenceList?.length) {
    throw new Error("这个 RunningHub 工作流需要先上传一张参考图。请在图片节点里上传图片后再点击生成。");
  }
  return await runRunningHubTask(config.prompt, model.modelName, "image", config.referenceList);
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  return await runRunningHubTask(config.prompt, model.modelName, "video", config.referenceList);
};

const ttsRequest = async (): Promise<string> => {
  throw new Error("RunningHub TTS is not exposed by this Toonflow entry.");
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "2.1", notice: "" };
};

const updateVendor = async (): Promise<string> => "";

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

export {};

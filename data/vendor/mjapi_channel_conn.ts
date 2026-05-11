/**
 * Cool API channel connection.
 * @version 1.2
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
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
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
  | { type: "image"; sourceType: "base64"; base64: string }
  | { type: "audio"; sourceType: "base64"; base64: string }
  | { type: "video"; sourceType: "base64"; base64: string };

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

const vendor: VendorConfig = {
  id: "mjapi_channel_conn",
  version: "1.2",
  author: "Toonflow",
  name: "Cool API Channel",
  description: "Cool API async image/video provider.",
  icon: "",
  inputs: [
    { key: "apiKey", label: "API Key", type: "password", required: true },
    { key: "baseUrl", label: "Base URL", type: "url", required: true, placeholder: "https://api.mjapi.cc.cd" },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://api.mjapi.cc.cd",
  },
  models: [
    { name: "GPT Image 2（1毛钱/秒）", modelName: "gpt_image_2", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "nano_banana_pro（1毛钱/秒）", modelName: "nano_banana_pro", type: "image", mode: ["text", "singleImage", "multiReference"] },
    {
      name: "Seedance 2.0（5毛钱/秒）",
      modelName: "seedance_2",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", "endFrameOptional"],
      audio: false,
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p", "1080p"] }],
    },
  ],
};

const getBaseUrl = () => {
  const baseUrl = (vendor.inputValues.baseUrl || "").replace(/\/+$/, "");
  return baseUrl.endsWith("/v1") ? baseUrl.slice(0, -3) : baseUrl;
};

const getHeaders = () => {
  if (!vendor.inputValues.apiKey) throw new Error("Missing API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
};

const normalizeBase64 = (value: string) => value.replace(/^data:[^;]+;base64,/, "");

const base64ToDataUrl = (value: string, type: "image" | "video" | "audio") => {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("data:")) return value;
  const mimeMap: Record<string, string> = {
    image: "image/png",
    video: "video/mp4",
    audio: "audio/mpeg",
  };
  return `data:${mimeMap[type]};base64,${normalizeBase64(value)}`;
};

const buildFiles = (referenceList: ReferenceList[] | undefined) => {
  const list = referenceList ?? [];
  return list.map((item, index) => ({
    url: base64ToDataUrl(item.base64, item.type),
    type: item.type,
    name: `${item.type}${index + 1}.${item.type === "image" ? "png" : item.type === "video" ? "mp4" : "mp3"}`,
  }));
};

const pickResultUrl = (result: any) =>
  result?.url || result?.thumbnail_url || result?.transcoder_url || result?.watermark_url || result?.standard_url?.large || result?.standard_url?.medium;

const pollCoolTask = async (taskId: string, mediaType: "image" | "video"): Promise<string> => {
  const pollResult = await pollTask(
    async (): Promise<PollResult> => {
      const response = await axios.get(`${getBaseUrl()}/v1/cool/task/${taskId}`, {
        headers: getHeaders(),
      });
      const data = response.data ?? {};
      const status = String(data.status ?? "").toLowerCase();

      if (status === "success") {
        const resultUrl = pickResultUrl(data.result);
        if (!resultUrl) {
          return { completed: true, error: "Task succeeded but no result URL was returned" };
        }
        return { completed: true, data: resultUrl };
      }

      if (status === "failed") {
        return { completed: true, error: data.error || "Task failed" };
      }

      return { completed: false };
    },
    5000,
    mediaType === "video" ? 1800000 : 600000,
  );

  if (pollResult.error) throw new Error(pollResult.error);
  if (!pollResult.data) throw new Error("Task completed without result data");
  return pollResult.data;
};

const textRequest = () => {
  throw new Error("mjapi_channel_conn does not support text models in Toonflow.");
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  const response = await axios.post(
    `${getBaseUrl()}/v1/cool/generate`,
    {
      prompt: config.prompt || "",
      model: model.modelName,
      ratio: config.aspectRatio || "1:1",
      files: buildFiles(config.referenceList),
    },
    { headers: getHeaders() },
  );

  const taskId = response.data?.task_id;
  if (!taskId) throw new Error(response.data?.message || "Image task creation failed");
  const resultUrl = await pollCoolTask(taskId, "image");
  return await urlToBase64(resultUrl);
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  const response = await axios.post(
    `${getBaseUrl()}/v1/cool/generate`,
    {
      prompt: config.prompt || "",
      model: model.modelName,
      ratio: config.aspectRatio || "16:9",
      duration: config.duration || 5,
      files: buildFiles(config.referenceList),
    },
    { headers: getHeaders() },
  );

  const taskId = response.data?.task_id;
  if (!taskId) throw new Error(response.data?.message || "Video task creation failed");
  const resultUrl = await pollCoolTask(taskId, "video");
  return await urlToBase64(resultUrl);
};

const ttsRequest = async (_config: TTSConfig, _model: TTSModel): Promise<string> => {
  return "";
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "1.2", notice: "" };
};

const updateVendor = async (): Promise<string> => {
  return "";
};

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

export {};

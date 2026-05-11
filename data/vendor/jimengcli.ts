/**
 * Toonflow AI供应商模板 - 即梦CLI桥接
 * @version 2.0
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

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel)[];
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

declare const axios: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: any, m: any) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};

const vendor: VendorConfig = {
  id: "jimengcli",
  version: "2.0",
  author: "Codex",
  name: "即梦CLI桥接",
  description:
    "通过本地 jimeng-bridge 调用即梦 dreamina CLI 生视频。\n\n使用前先启动桥接服务并完成 dreamina 登录。\n推荐命令：node scripts/jimeng-bridge.mjs",
  inputs: [
    { key: "bridgeUrl", label: "桥接服务地址", type: "url", required: true, placeholder: "http://127.0.0.1:18765" },
    { key: "timeoutSec", label: "查询超时秒数", type: "text", required: false, placeholder: "600" },
  ],
  inputValues: {
    bridgeUrl: "http://127.0.0.1:18765",
    timeoutSec: "600",
  },
  models: [
    {
      name: "即梦CLI Seedance2 Fast",
      modelName: "seedance2.0fast",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", "endFrameOptional"],
      audio: false,
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p"] }],
    },
    {
      name: "即梦CLI Seedance2",
      modelName: "seedance2.0",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", "endFrameOptional"],
      audio: false,
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p"] }],
    },
    {
      name: "即梦CLI Seedance2 Fast VIP",
      modelName: "seedance2.0fast_vip",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", "endFrameOptional"],
      audio: false,
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p"] }],
    },
    {
      name: "即梦CLI Seedance2 VIP",
      modelName: "seedance2.0_vip",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", "endFrameOptional"],
      audio: false,
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p"] }],
    },
  ],
};

const textRequest = () => {
  throw new Error("jimengcli 供应商不支持文本模型，请仅用于视频生成");
};

const imageRequest = async (_config: ImageConfig, _model: ImageModel): Promise<string> => {
  throw new Error("jimengcli 供应商不支持图片生成，请仅用于视频生成");
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  const bridgeUrl = (vendor.inputValues.bridgeUrl || "http://127.0.0.1:18765").replace(/\/+$/, "");
  const timeoutSec = Math.max(30, Number(vendor.inputValues.timeoutSec || "600"));
  const imageRefs = (config.referenceList || []).filter((r) => r.type === "image").map((r) => r.base64);

  const payload = {
    prompt: config.prompt || "",
    images: imageRefs,
    duration: config.duration || 5,
    ratio: config.aspectRatio || "9:16",
    video_resolution: config.resolution || "720p",
    model_version: model.modelName || "seedance2.0fast",
    timeout_sec: timeoutSec,
    poll_interval_sec: 5,
  };

  const response = await axios.post(`${bridgeUrl}/v1/video/generate`, payload, {
    timeout: (timeoutSec + 120) * 1000,
  });

  if (!response?.data?.ok) {
    throw new Error(response?.data?.error || "即梦CLI桥接生成失败");
  }
  if (!response?.data?.base64) {
    throw new Error("即梦CLI桥接未返回视频数据");
  }
  return response.data.base64;
};

const ttsRequest = async (): Promise<string> => {
  return "";
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "2.0", notice: "" };
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


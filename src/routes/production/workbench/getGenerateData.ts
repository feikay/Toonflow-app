import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

interface VideoItem {
  id: number;
  src: string;
  state: "未生成" | "生成中" | "已完成" | "生成失败";
  errorReason?: string;
}

interface TrackMedia {
  src: string;
  id?: number;
  fileType: "image" | "video" | "audio";
  videoDesc?: string;
  prompt?: string;
  sources?: "assets" | "storyboard";
  index?: number | null;
  shotType?: string | null;
  cameraAngle?: string | null;
  cameraMovement?: string | null;
  composition?: string | null;
  actorBlocking?: string | null;
  emotionBeat?: string | null;
  directorNote?: string | null;
  panoramaSceneId?: number | null;
  panoramaHotspotId?: number | null;
  panoramaView?: string | null;
  lensPreset?: string | null;
  panoramaScene?: {
    id: number;
    name: string;
    prompt?: string | null;
    aspectType?: string | null;
    meta?: string | null;
  } | null;
  panoramaHotspot?: {
    id: number;
    label?: string | null;
    type?: string | null;
    meta?: string | null;
    yaw?: number | null;
    pitch?: number | null;
    fov?: number | null;
  } | null;
}

interface TrackItem {
  id?: number;
  prompt: string;
  state: "未生成" | "生成中" | "已完成" | "生成失败";
  reason?: string;
  duration?: number;
  selectVideoId?: number;
  medias: TrackMedia[];
  videoList: VideoItem[];
}

function normalizeVideoState(value?: string | null): VideoItem["state"] {
  if (value === "已完成" || value === "生成成功") return "已完成";
  if (value === "生成中") return "生成中";
  if (value === "生成失败") return "生成失败";
  return "未生成";
}

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
  }),
  async (req, res) => {
    const { projectId, scriptId } = req.body;
    const projectData = await u.db("o_project").where("id", projectId).select("id", "videoModel", "mode").first();

    if (!projectData?.videoModel) {
      return res.status(400).json(success("项目未配置视频模型"));
    }

    let videoMode = "";
    try {
      videoMode = JSON.parse(projectData.mode ?? "");
    } catch {
      videoMode = projectData.mode ?? "";
    }
    const isRef = Array.isArray(videoMode);

    const storyboardList = await u.db("o_storyboard").where({ scriptId, projectId }).orderBy("index", "asc");

    const panoramaSceneIds = [...new Set(storyboardList.map((item) => item.panoramaSceneId).filter((id): id is number => typeof id === "number"))];
    const panoramaHotspotIds = [...new Set(storyboardList.map((item) => item.panoramaHotspotId).filter((id): id is number => typeof id === "number"))];
    const panoramaScenes = panoramaSceneIds.length ? await u.db("o_panoramaScene").whereIn("id", panoramaSceneIds) : [];
    const panoramaHotspots = panoramaHotspotIds.length ? await u.db("o_panoramaHotspot").whereIn("id", panoramaHotspotIds) : [];
    const panoramaSceneMap = Object.fromEntries(
      panoramaScenes.map((item) => [
        item.id,
        {
          id: item.id ?? 0,
          name: item.name ?? "",
          prompt: item.prompt ?? null,
          aspectType: item.aspectType ?? null,
          meta: item.meta ?? null,
        },
      ]),
    );
    const panoramaHotspotMap = Object.fromEntries(
      panoramaHotspots.map((item) => [
        item.id,
        {
          id: item.id ?? 0,
          label: item.label ?? null,
          type: item.type ?? null,
          meta: item.meta ?? null,
          yaw: item.yaw ?? null,
          pitch: item.pitch ?? null,
          fov: item.fov ?? null,
        },
      ]),
    );

    await Promise.all(
      storyboardList.map(async (item) => {
        item.filePath = item.filePath ? await u.oss.getFileUrl(item.filePath) : "";
      }),
    );

    const storyboardTrackRecord: Record<number, TrackMedia[]> = {};
    storyboardList.forEach((item) => {
      const media: TrackMedia = {
        src: item.filePath ?? "",
        fileType: "image",
        sources: "storyboard",
        ...(item.videoDesc != null ? { videoDesc: item.videoDesc } : {}),
        ...(item.prompt != null ? { prompt: item.prompt } : {}),
        ...(item.id != null ? { id: item.id } : {}),
        index: item.index ?? null,
        shotType: item.shotType ?? null,
        cameraAngle: item.cameraAngle ?? null,
        cameraMovement: item.cameraMovement ?? null,
        composition: item.composition ?? null,
        actorBlocking: item.actorBlocking ?? null,
        emotionBeat: item.emotionBeat ?? null,
        directorNote: item.directorNote ?? null,
        panoramaSceneId: item.panoramaSceneId ?? null,
        panoramaHotspotId: item.panoramaHotspotId ?? null,
        panoramaView: item.panoramaView ?? null,
        lensPreset: item.lensPreset ?? null,
        panoramaScene: item.panoramaSceneId ? panoramaSceneMap[item.panoramaSceneId] ?? null : null,
        panoramaHotspot: item.panoramaHotspotId ? panoramaHotspotMap[item.panoramaHotspotId] ?? null : null,
      };

      if (!storyboardTrackRecord[item.trackId!]) {
        storyboardTrackRecord[item.trackId!] = [];
      }
      storyboardTrackRecord[item.trackId!].push(media);
    });

    const otherDataMap: Record<number, any[]> = {};
    if (isRef) {
      const storyIds = storyboardList.map((item) => item.id).filter(Boolean) as number[];
      const assetDatas = storyIds.length
        ? await u
          .db("o_assets2Storyboard")
          .leftJoin("o_assets", "o_assets2Storyboard.assetId", "o_assets.id")
          .leftJoin("o_image", "o_image.id", "o_assets.imageId")
          .whereIn("o_assets2Storyboard.storyboardId", storyIds)
          .select("o_assets.*", "o_image.filePath", "o_assets2Storyboard.storyboardId")
        : [];

      await Promise.all(
        assetDatas.map(async (item) => {
          const asset = {
            id: item.id,
            name: item.name,
            describe: item.describe,
            type: item.type,
            fileType: "image" as const,
            sources: "assets" as const,
            src: item.filePath ? await u.oss.getFileUrl(item.filePath) : "",
          };
          const sid = item.storyboardId as number;
          if (!otherDataMap[sid]) otherDataMap[sid] = [];
          otherDataMap[sid].push(asset);
        }),
      );
    }

    const trackData = await u.db("o_videoTrack").where({ projectId, scriptId });
    const trackIds = trackData.map((item) => item.id).filter(Boolean) as number[];
    const videoList = trackIds.length ? await u.db("o_video").whereIn("videoTrackId", trackIds) : [];

    const trackList: TrackItem[] = [];
    const trackIdMap = [...new Set<number>(trackData.map((item) => item.id!).filter(Boolean))];
    for (const trackId of trackIdMap) {
      const track = trackData.find((item) => item.id === trackId);
      trackList.push({
        id: trackId,
        duration: track?.duration ?? 0,
        prompt: track?.prompt || "",
        state: normalizeVideoState(track?.state),
        reason: track?.reason ?? "",
        selectVideoId: Number(track?.videoId)!,
        medias: (() => {
          const storyboardMedias = storyboardTrackRecord[trackId] ?? [];
          const assetMedias = storyboardMedias.flatMap((item) => (item.id ? otherDataMap[item.id] ?? [] : []));
          const seenAssetIds = new Set<number>();
          const uniqueAssets = assetMedias.filter((item) => {
            if (seenAssetIds.has(item.id)) return false;
            seenAssetIds.add(item.id);
            return true;
          });
          const hasImageAssetData = uniqueAssets.filter((item) => item.src);
          const notHasImageAssetData = uniqueAssets.filter((item) => !item.src);

          return [...hasImageAssetData, ...storyboardMedias, ...notHasImageAssetData];
        })(),
        videoList: await Promise.all(
          videoList
            .filter((item) => item.videoTrackId === trackId)
            .map(async (item) => ({
              id: item.id ?? 0,
              src: item.filePath ? await u.oss.getFileUrl(item.filePath) : "",
              state: normalizeVideoState(item.state),
              errorReason: item.errorReason ?? "",
            })),
        ),
      });
    }

    return res.status(200).send(
      success({
        storyboardList: storyboardList.map((item) => ({
          ...item,
          src: item.filePath,
          shotType: item.shotType ?? null,
          cameraAngle: item.cameraAngle ?? null,
          cameraMovement: item.cameraMovement ?? null,
          composition: item.composition ?? null,
          actorBlocking: item.actorBlocking ?? null,
          emotionBeat: item.emotionBeat ?? null,
          directorNote: item.directorNote ?? null,
          panoramaSceneId: item.panoramaSceneId ?? null,
          panoramaHotspotId: item.panoramaHotspotId ?? null,
          panoramaView: item.panoramaView ?? null,
          lensPreset: item.lensPreset ?? null,
          panoramaScene: item.panoramaSceneId ? panoramaSceneMap[item.panoramaSceneId] ?? null : null,
          panoramaHotspot: item.panoramaHotspotId ? panoramaHotspotMap[item.panoramaHotspotId] ?? null : null,
        })),
        trackList,
      }),
    );
  },
);

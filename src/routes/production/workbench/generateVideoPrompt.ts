import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

function xmlEscape(value?: string | null) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildStoryboardDirective(item: {
  videoDesc?: string | null;
  duration?: string | number | null;
  shotType?: string | null;
  cameraAngle?: string | null;
  cameraMovement?: string | null;
  composition?: string | null;
  actorBlocking?: string | null;
  emotionBeat?: string | null;
  directorNote?: string | null;
  panoramaView?: string | null;
  lensPreset?: string | null;
  panoramaSceneName?: string | null;
  panoramaScenePrompt?: string | null;
  panoramaSceneAspectType?: string | null;
  panoramaHotspotLabel?: string | null;
  panoramaHotspotType?: string | null;
  panoramaHotspotMeta?: string | null;
}) {
  const attrs = [
    `videoDesc='${xmlEscape(item.videoDesc)}'`,
    `duration='${xmlEscape(item.duration != null ? String(item.duration) : "")}'`,
  ];

  const extraFields: Array<[string, string | null | undefined]> = [
    ["shotType", item.shotType],
    ["cameraAngle", item.cameraAngle],
    ["cameraMovement", item.cameraMovement],
    ["composition", item.composition],
    ["actorBlocking", item.actorBlocking],
    ["emotionBeat", item.emotionBeat],
    ["directorNote", item.directorNote],
    ["panoramaView", item.panoramaView],
    ["lensPreset", item.lensPreset],
    ["panoramaSceneName", item.panoramaSceneName],
    ["panoramaScenePrompt", item.panoramaScenePrompt],
    ["panoramaSceneAspectType", item.panoramaSceneAspectType],
    ["panoramaHotspotLabel", item.panoramaHotspotLabel],
    ["panoramaHotspotType", item.panoramaHotspotType],
    ["panoramaHotspotMeta", item.panoramaHotspotMeta],
  ];

  for (const [key, value] of extraFields) {
    if (value != null && String(value).trim()) {
      attrs.push(`${key}='${xmlEscape(String(value))}'`);
    }
  }

  return `<storyboardItem ${attrs.join(" ")}></storyboardItem>`;
}

export default router.post(
  "/",
  validateFields({
    trackId: z.number(),
    projectId: z.number(),
    info: z.array(
      z.object({
        id: z.number(),
        sources: z.string(),
      }),
    ),
    model: z.string(),
  }),
  async (req, res) => {
    const { trackId, projectId, info, model } = req.body;

    const images = await Promise.all(
      info.map(async (item: { id: number; sources: string }) => {
        if (item.sources === "storyboard") {
          const storyboard = await u
            .db("o_storyboard")
            .where("o_storyboard.id", item.id)
            .select(
              "o_storyboard.id",
              "o_storyboard.videoDesc",
              "o_storyboard.prompt",
              "o_storyboard.track",
              "o_storyboard.duration",
              "o_storyboard.shouldGenerateImage",
              "o_storyboard.shotType",
              "o_storyboard.cameraAngle",
              "o_storyboard.cameraMovement",
              "o_storyboard.composition",
              "o_storyboard.actorBlocking",
              "o_storyboard.emotionBeat",
              "o_storyboard.directorNote",
              "o_storyboard.panoramaSceneId",
              "o_storyboard.panoramaHotspotId",
              "o_storyboard.panoramaView",
              "o_storyboard.lensPreset",
            )
            .first();

          if (!storyboard) return null;

          const assetRows = await u.db("o_assets2Storyboard").where("storyboardId", item.id).orderBy("rowid").select("assetId");
          const associateAssetsIds = assetRows.map((row: any) => row.assetId);

          let panoramaScene = null as any;
          if (storyboard.panoramaSceneId) {
            panoramaScene = await u
              .db("o_panoramaScene")
              .where("id", storyboard.panoramaSceneId)
              .select("id", "name", "prompt", "aspectType", "meta")
              .first();
          }

          let panoramaHotspot = null as any;
          if (storyboard.panoramaHotspotId) {
            panoramaHotspot = await u
              .db("o_panoramaHotspot")
              .where("id", storyboard.panoramaHotspotId)
              .select("id", "label", "type", "meta", "yaw", "pitch", "fov")
              .first();
          }

          return {
            ...storyboard,
            associateAssetsIds,
            panoramaScene,
            panoramaHotspot,
            _type: "storyboard",
          };
        }

        if (item.sources === "assets") {
          const assetsData = await u
            .db("o_assets")
            .leftJoin("o_image", "o_image.id", "o_assets.imageId")
            .where("o_assets.id", item.id)
            .select("o_assets.id", "o_assets.type", "o_assets.name", "o_image.filePath")
            .first();
          return {
            ...assetsData,
            _type: "assets",
          };
        }

        return null;
      }),
    );

    const assets: any[] = [];
    const storyboard: any[] = [];
    for (const item of images) {
      if (!item) continue;
      if (item._type === "assets") {
        assets.push({
          id: item.id,
          type: item.type,
          name: item.name,
          filePath: item.filePath,
        });
      }
      if (item._type === "storyboard") {
        storyboard.push({
          id: item.id,
          videoDesc: item.videoDesc,
          prompt: item.prompt,
          track: item.track,
          duration: item.duration,
          associateAssetsIds: item.associateAssetsIds,
          shouldGenerateImage: item.shouldGenerateImage,
          shotType: item.shotType,
          cameraAngle: item.cameraAngle,
          cameraMovement: item.cameraMovement,
          composition: item.composition,
          actorBlocking: item.actorBlocking,
          emotionBeat: item.emotionBeat,
          directorNote: item.directorNote,
          panoramaView: item.panoramaView,
          lensPreset: item.lensPreset,
          panoramaScene: item.panoramaScene,
          panoramaHotspot: item.panoramaHotspot,
        });
      }
    }

    const [, modelData] = model.split(/:(.+)/);
    const projectData = await u.db("o_project").select("*").where({ id: projectId }).first();
    const videoPrompt = await u.db("o_prompt").where("type", "videoPromptGeneration").first();

    const videoPromptGeneration = videoPrompt?.useData || videoPrompt?.data || undefined;
    const artStyle = projectData?.artStyle || "默认";
    const visualManual = u.getArtPrompt(artStyle, "art_skills", "art_storyboard_video");

    const assetsText = assets
      .filter((item) => item.filePath)
      .map((item) => `[${item.id},${item.type},${item.name}]`)
      .join("，");

    const storyboardText = storyboard
      .map((item) =>
        buildStoryboardDirective({
          videoDesc: item.videoDesc,
          duration: item.duration,
          shotType: item.shotType,
          cameraAngle: item.cameraAngle,
          cameraMovement: item.cameraMovement,
          composition: item.composition,
          actorBlocking: item.actorBlocking,
          emotionBeat: item.emotionBeat,
          directorNote: item.directorNote,
          panoramaView: item.panoramaView,
          lensPreset: item.lensPreset,
          panoramaSceneName: item.panoramaScene?.name ?? null,
          panoramaScenePrompt: item.panoramaScene?.prompt ?? null,
          panoramaSceneAspectType: item.panoramaScene?.aspectType ?? null,
          panoramaHotspotLabel: item.panoramaHotspot?.label ?? null,
          panoramaHotspotType: item.panoramaHotspot?.type ?? null,
          panoramaHotspotMeta:
            item.panoramaHotspot != null
              ? [
                  item.panoramaHotspot.meta,
                  item.panoramaHotspot.yaw != null ? `yaw=${item.panoramaHotspot.yaw}` : null,
                  item.panoramaHotspot.pitch != null ? `pitch=${item.panoramaHotspot.pitch}` : null,
                  item.panoramaHotspot.fov != null ? `fov=${item.panoramaHotspot.fov}` : null,
                ]
                  .filter(Boolean)
                  .join("; ")
              : null,
        }),
      )
      .join("\n");

    const content = `
**模型名称**：${modelData}
**资产信息**（角色、场景、道具）：${assetsText}
**分镜信息**：
${storyboardText}

请在生成视频提示词时，把每条分镜上的导演字段当作镜头控制层优先参考：
- shotType：景别
- cameraAngle：机位角度
- cameraMovement：运镜方式
- composition：构图方式
- actorBlocking：角色调度
- emotionBeat：情绪节拍
- directorNote：导演备注
- panoramaSceneName / panoramaScenePrompt / panoramaSceneAspectType：场景母板信息
- panoramaHotspotLabel / panoramaHotspotType / panoramaHotspotMeta / panoramaView：全景取景与机位热点信息
- lensPreset：镜头预设

如果导演字段与 videoDesc 有补充关系，请合并使用；如果出现冲突，优先保留导演字段体现的镜头控制意图，同时保持剧情动作和场景连续性。
`;

    try {
      const { text } = await u.Ai.Text("universalAi").invoke({
        system: videoPromptGeneration,
        messages: [
          {
            role: "assistant",
            content: `${visualManual}`,
          },
          {
            role: "user",
            content,
          },
        ],
      });

      await u.db("o_videoTrack").where({ id: trackId }).update({
        prompt: text,
      });

      return res.status(200).send(success(text));
    } catch (e) {
      return res.status(400).send(error(u.error(e).message));
    }
  },
);

import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { assetItemSchema } from "@/agents/productionAgent/tools";
import { buildStoryboardDirectorPrompt, mergeStoryboardReferenceImageIds } from "@/lib/storyboardDirectorPrompt";

const router = express.Router();

export type AssetData = z.infer<typeof assetItemSchema>;

export default router.post(
  "/",
  validateFields({
    storyboardIds: z.array(z.number()),
    projectId: z.number(),
    scriptId: z.number(),
    concurrentCount: z.number().min(1).optional(),
  }),
  async (req, res) => {
    const {
      storyboardIds,
      projectId,
      scriptId,
      concurrentCount = 5,
    }: {
      storyboardIds: number[];
      projectId: number;
      scriptId: number;
      concurrentCount: number;
    } = req.body;

    if (!storyboardIds.length) {
      return res.status(400).send(error("storyboardIds不能为空"));
    }

    await u
      .db("o_storyboard")
      .whereIn("id", storyboardIds)
      .where("scriptId", scriptId)
      .where("shouldGenerateImage", 0)
      .update({ state: "未生成" });

    await u
      .db("o_storyboard")
      .whereIn("id", storyboardIds)
      .where("scriptId", scriptId)
      .where("shouldGenerateImage", 1)
      .update({ state: "生成中" });

    const projectSettingData = await u.db("o_project").where("id", projectId).select("imageModel", "imageQuality", "artStyle", "videoRatio").first();
    const storyboardData = await u.db("o_storyboard").where("scriptId", scriptId).whereIn("id", storyboardIds);

    const panoramaSceneIds = [...new Set(storyboardData.map((item) => item.panoramaSceneId).filter((id): id is number => typeof id === "number"))];
    const panoramaHotspotIds = [...new Set(storyboardData.map((item) => item.panoramaHotspotId).filter((id): id is number => typeof id === "number"))];
    const panoramaScenes = panoramaSceneIds.length ? await u.db("o_panoramaScene").whereIn("id", panoramaSceneIds) : [];
    const panoramaHotspots = panoramaHotspotIds.length ? await u.db("o_panoramaHotspot").whereIn("id", panoramaHotspotIds) : [];
    const panoramaSceneMap = Object.fromEntries(panoramaScenes.map((item) => [item.id, item]));
    const panoramaHotspotMap = Object.fromEntries(panoramaHotspots.map((item) => [item.id, item]));

    const assets2StoryboardRows = await u
      .db("o_assets2Storyboard")
      .whereIn("storyboardId", storyboardIds)
      .orderBy("rowid")
      .select("storyboardId", "assetId");

    const allAssetIds = [...new Set(assets2StoryboardRows.map((row: any) => row.assetId))];
    const assetImageMap: Record<number, number> = {};
    if (allAssetIds.length) {
      const assetRows = await u.db("o_assets").whereIn("id", allAssetIds).select("id", "imageId");
      assetRows.forEach((row: any) => {
        if (row.imageId != null) assetImageMap[row.id] = row.imageId;
      });
    }

    const assetRecord: Record<number, number[]> = {};
    assets2StoryboardRows.forEach((item: any) => {
      if (!assetRecord[item.storyboardId]) {
        assetRecord[item.storyboardId] = [];
      }
      const imageId = assetImageMap[item.assetId];
      if (imageId != null) {
        assetRecord[item.storyboardId].push(imageId);
      }
    });

    res.status(200).send(
      success(
        storyboardData.map((item) => ({
          id: item.id,
          prompt: item.prompt,
          associateAssetsIds: assetRecord[item.id!] ?? [],
          src: null,
          state: item.state,
          videoDesc: item.videoDesc,
          shouldGenerateImage: item.shouldGenerateImage,
        })),
      ),
    );

    const generateTask = async (item: (typeof storyboardData)[number]) => {
      const panoramaScene = item.panoramaSceneId ? panoramaSceneMap[item.panoramaSceneId] : null;
      const panoramaHotspot = item.panoramaHotspotId ? panoramaHotspotMap[item.panoramaHotspotId] : null;
      const finalPrompt = buildStoryboardDirectorPrompt(item, panoramaScene, panoramaHotspot);
      const referenceImageIds = mergeStoryboardReferenceImageIds(assetRecord[item.id!] ?? [], panoramaScene);
      const payload = {
        prompt: finalPrompt,
        size: projectSettingData?.imageQuality as "1K" | "2K" | "4K",
        aspectRatio: projectSettingData?.videoRatio as `${number}:${number}`,
      };

      await u.Ai.Image(projectSettingData?.imageModel as `${string}:${string}`)
        .run(
          {
            referenceList: await getAssetsImageBase64(referenceImageIds),
            ...payload,
          },
          {
            taskClass: "生成分镜图片",
            describe: "分镜图片生成",
            relatedObjects: JSON.stringify({
              ...payload,
              directorFields: {
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
              },
            }),
            projectId,
          },
        )
        .then(async (imageCls) => {
          const savePath = `/${projectId}/assets/${scriptId}/${u.uuid()}.jpg`;
          await imageCls.save(savePath);
          await u.db("o_storyboard").where("id", item.id).update({
            filePath: savePath,
            state: "已完成",
          });
        })
        .catch(async (e) => {
          await u.db("o_storyboard").where("id", item.id).update({
            filePath: "",
            reason: u.error(e).message,
            state: "生成失败",
          });
        });
    };

    const generateList = storyboardData.filter((item) => item.shouldGenerateImage !== 0);
    for (let i = 0; i < generateList.length; i += concurrentCount) {
      const batch = generateList.slice(i, i + concurrentCount);
      await Promise.all(batch.map(generateTask));
    }
  },
);

async function getAssetsImageBase64(imageIds: number[]) {
  if (!imageIds.length) return [];

  const imageRows = await u.db("o_image").whereIn("o_image.id", imageIds).select("o_image.id", "o_image.filePath");
  const id2Path = new Map<number, string>();
  for (const row of imageRows) {
    if (row.filePath) id2Path.set(row.id, row.filePath);
  }

  const imageUrls = await Promise.all(
    imageIds.map(async (id) => {
      const filePath = id2Path.get(id);
      if (!filePath) return null;
      try {
        return await u.oss.getImageBase64(filePath);
      } catch {
        return null;
      }
    }),
  );

  return (imageUrls.filter(Boolean) as string[]).map((base64) => ({ type: "image" as const, base64 }));
}

import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { FlowData } from "@/agents/productionAgent/tools";

const router = express.Router();

async function buildPanoramaScenes(projectId: number, episodesId: number) {
  const panoramaScenes = await u
    .db("o_panoramaScene")
    .where({ projectId, scriptId: episodesId })
    .orderBy("updateTime", "desc")
    .orderBy("id", "desc");

  const sceneIds = panoramaScenes.map((scene) => scene.id).filter(Boolean) as number[];
  const panoramaHotspots = sceneIds.length
    ? await u.db("o_panoramaHotspot").whereIn("panoramaSceneId", sceneIds).orderBy("id", "asc")
    : [];

  const hotspotMap = panoramaHotspots.reduce<Record<number, any[]>>((acc, hotspot) => {
    if (!hotspot.panoramaSceneId) return acc;
    if (!acc[hotspot.panoramaSceneId]) acc[hotspot.panoramaSceneId] = [];
    acc[hotspot.panoramaSceneId].push(hotspot);
    return acc;
  }, {});

  return await Promise.all(
    panoramaScenes.map(async (scene) => ({
      id: scene.id ?? 0,
      projectId: scene.projectId ?? projectId,
      scriptId: scene.scriptId ?? episodesId,
      name: scene.name ?? "",
      prompt: scene.prompt ?? null,
      aspectType: (scene.aspectType ?? "360") as "360" | "720",
      src: scene.filePath ? await u.oss.getFileUrl(scene.filePath) : null,
      imageId: scene.imageId ?? null,
      width: scene.width ?? null,
      height: scene.height ?? null,
      meta: scene.meta ?? null,
      hotspots: (hotspotMap[scene.id!] ?? []).map((hotspot) => ({
        id: hotspot.id ?? 0,
        panoramaSceneId: hotspot.panoramaSceneId ?? scene.id ?? 0,
        type: hotspot.type ?? null,
        label: hotspot.label ?? null,
        x: hotspot.x ?? null,
        y: hotspot.y ?? null,
        yaw: hotspot.yaw ?? null,
        pitch: hotspot.pitch ?? null,
        fov: hotspot.fov ?? null,
        meta: hotspot.meta ?? null,
      })),
    })),
  );
}

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    episodesId: z.number(),
  }),
  async (req, res) => {
    const { projectId, episodesId }: { projectId: number; episodesId: number } = req.body;
    const sqlData = await u
      .db("o_agentWorkData")
      .where("projectId", String(projectId))
      .andWhere("episodesId", String(episodesId))
      .select("data")
      .first();

    const scriptData = await u.db("o_script").where("projectId", projectId).where("id", episodesId).first();
    const scriptAssets = await u.db("o_scriptAssets").where("scriptId", episodesId);
    const assetIds = scriptAssets.map((item) => item.assetId);
    const assetsData = await u
      .db("o_assets")
      .leftJoin("o_image", "o_assets.imageId", "o_image.id")
      .select("o_assets.*", "o_image.filePath", "o_image.state", "o_image.errorReason")
      // @ts-ignore
      .where("o_assets.id", "in", assetIds)
      .andWhere("o_assets.assetsId", null)
      .where("o_assets.projectId", projectId);

    const childAssetsData = await u
      .db("o_assets")
      .leftJoin("o_image", "o_assets.imageId", "o_image.id")
      .select("o_assets.*", "o_image.filePath", "o_image.state", "o_image.errorReason")
      .where("o_assets.projectId", projectId)
      // @ts-ignore
      .where("o_assets.assetsId", "in", assetIds)
      .whereNotNull("o_assets.assetsId");

    const panoramaScenes = await buildPanoramaScenes(projectId, episodesId);

    if (!sqlData) {
      const flowData = {
        script: scriptData?.content ?? "",
        scriptPlan: "",
        assets: await Promise.all(
          assetsData.map(async (item) => ({
            id: item.id,
            name: item.name ?? "",
            type: item.type ?? "",
            prompt: item.prompt ?? "",
            desc: item.describe ?? "",
            src: item.filePath ? await u.oss.getFileUrl(item.filePath) : null,
            derive: await Promise.all(
              childAssetsData
                .filter((child) => child.assetsId === item.id)
                .map(async (child) => ({
                  id: child.id,
                  assetsId: item.id,
                  name: child.name ?? "",
                  type: child.type,
                  prompt: child.prompt,
                  desc: child.describe ?? "",
                  src: child.filePath ? await u.oss.getFileUrl(child.filePath) : null,
                  state: child.state ?? "未生成",
                })),
            ),
          })),
        ),
        storyboardTable: "",
        storyboard: [],
        panoramaScenes,
      } as FlowData;

      return res.status(200).send(success(flowData));
    }

    try {
      const storyboardData = await u.db("o_storyboard").where("scriptId", episodesId);

      await Promise.all(
        storyboardData.map(async (item) => {
          if (!item.filePath) {
            item.filePath = "";
            return;
          }
          try {
            item.filePath = await u.oss.getFileUrl(item.filePath);
          } catch {
            item.filePath = "";
          }
        }),
      );

      const storyboardIds = storyboardData.map((item) => item.id);
      const assetsIds = storyboardIds.length
        ? await u.db("o_assets2Storyboard").whereIn("storyboardId", storyboardIds).orderBy("rowid")
        : [];

      const assets2StoryboardMap: Record<number, number[]> = {};
      assetsIds.forEach((item) => {
        if (!item.storyboardId) return;
        if (!assets2StoryboardMap[item.storyboardId]) {
          assets2StoryboardMap[item.storyboardId] = [];
        }
        assets2StoryboardMap[item.storyboardId].push(item.assetId!);
      });

      const flowData = JSON.parse(sqlData.data ?? "{}") as Partial<FlowData> & Record<string, any>;
      flowData.assets = await Promise.all(
        assetsData.map(async (item) => ({
          id: item.id,
          name: item.name ?? "",
          type: item.type ?? "",
          prompt: item.prompt ?? "",
          desc: item.describe ?? "",
          src: item.filePath ? await u.oss.getFileUrl(item.filePath) : null,
          flowId: item.flowId,
          derive: await Promise.all(
            childAssetsData
              .filter((child) => child.assetsId === item.id)
              .map(async (child) => ({
                id: child.id,
                assetsId: item.id,
                name: child.name ?? "",
                prompt: child.prompt,
                type: child.type,
                desc: child.describe ?? "",
                src: child.filePath ? await u.oss.getFileUrl(child.filePath) : null,
                state: child.state ?? "未生成",
                errorReason: child?.errorReason ?? "",
                flowId: child.flowId,
              })),
          ),
        })),
      );

      flowData.storyboard = storyboardData
        .map((item) => ({
          id: item.id ?? 0,
          index: item.index,
          duration: item.duration ? +item.duration : 0,
          prompt: item.prompt ?? "",
          associateAssetsIds: assets2StoryboardMap[item.id!] ?? [],
          src: item.filePath ?? null,
          state: item.state,
          videoDesc: item.videoDesc,
          shouldGenerateImage: item.shouldGenerateImage,
          reason: item.reason ?? "",
          flowId: item.flowId,
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
        }))
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      flowData.panoramaScenes = panoramaScenes;

      return res.status(200).send(success(flowData));
    } catch (err) {
      return res.status(400).send(error());
    }
  },
);

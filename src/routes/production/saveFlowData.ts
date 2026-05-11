import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { flowDataSchema } from "@/agents/productionAgent/tools";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    episodesId: z.number(),
    data: z.any(),
  }),
  async (req, res) => {
    const {
      data,
      projectId,
      episodesId,
    }: {
      data: z.infer<typeof flowDataSchema>;
      projectId: number;
      episodesId: number;
    } = req.body;

    const sqlData = await u.db("o_agentWorkData").where("projectId", String(projectId)).andWhere("episodesId", String(episodesId)).first();
    let preservedFreeCanvas: any = undefined;
    if (sqlData?.data) {
      try {
        preservedFreeCanvas = JSON.parse(sqlData.data).freeCanvas;
      } catch {
        preservedFreeCanvas = undefined;
      }
    }
    if (preservedFreeCanvas && !(data as any).freeCanvas) {
      (data as any).freeCanvas = preservedFreeCanvas;
    }
    const pendingNewStoryboards = data.storyboard.filter((item) => !item.id);

    if (data.storyboard.length && !pendingNewStoryboards.length) {
      try {
        await Promise.all(
          data.storyboard.map(async (item, index) => {
            await u.db("o_storyboard").where("id", item.id).update({
              index,
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
            });
          }),
        );
      } catch (err) {
        console.error("更新分镜排序失败", err);
      }
    }

    if (!sqlData) {
      await u.db("o_agentWorkData").insert({
        projectId,
        episodesId,
        key: "productionAgent",
        data: JSON.stringify(data),
      });
    } else {
      await u
        .db("o_agentWorkData")
        .where("projectId", String(projectId))
        .where("key", "productionAgent")
        .andWhere("episodesId", String(episodesId))
        .update({
          data: JSON.stringify(data),
        });
    }

    return res.status(200).send(success());
  },
);

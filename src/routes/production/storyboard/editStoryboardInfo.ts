import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { id } from "zod/locales";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
    prompt: z.string(),
    videoDesc: z.string(),
    shotType: z.string().optional().nullable(),
    cameraAngle: z.string().optional().nullable(),
    cameraMovement: z.string().optional().nullable(),
    composition: z.string().optional().nullable(),
    actorBlocking: z.string().optional().nullable(),
    emotionBeat: z.string().optional().nullable(),
    directorNote: z.string().optional().nullable(),
    panoramaSceneId: z.number().optional().nullable(),
    panoramaHotspotId: z.number().optional().nullable(),
    panoramaView: z.string().optional().nullable(),
    lensPreset: z.string().optional().nullable(),
  }),
  async (req, res) => {
    const {
      id,
      prompt,
      videoDesc,
      shotType,
      cameraAngle,
      cameraMovement,
      composition,
      actorBlocking,
      emotionBeat,
      directorNote,
      panoramaSceneId,
      panoramaHotspotId,
      panoramaView,
      lensPreset,
    } = req.body;
    await u.db("o_storyboard").where({ id }).update({
      prompt,
      videoDesc,
      shotType: shotType ?? null,
      cameraAngle: cameraAngle ?? null,
      cameraMovement: cameraMovement ?? null,
      composition: composition ?? null,
      actorBlocking: actorBlocking ?? null,
      emotionBeat: emotionBeat ?? null,
      directorNote: directorNote ?? null,
      panoramaSceneId: panoramaSceneId ?? null,
      panoramaHotspotId: panoramaHotspotId ?? null,
      panoramaView: panoramaView ?? null,
      lensPreset: lensPreset ?? null,
    });
    res.status(200).send(success({ message: "更新提示词成功" }));
  },
);

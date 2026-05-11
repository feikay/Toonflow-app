import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();
interface Storyboard {
  id: number;
  track: string;
  src: string | null;
  associateAssetsIds: number[];
  duration: number;
  state: string;
}
export default router.post(
  "/",
  validateFields({
    prompt: z.string(),
    duration: z.number(),
    state: z.string(),
    videoDesc: z.string(),
    shouldGenerateImage: z.number(),
    src: z.string().nullable(),
    scriptId: z.number(),
    projectId: z.number(),
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
      prompt,
      duration,
      state,
      src,
      scriptId,
      projectId,
      videoDesc,
      shouldGenerateImage,
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

    const [trackId] = await u.db("o_videoTrack").insert({
      scriptId: scriptId,
      projectId,
    });
    const [id] = await u.db("o_storyboard").insert({
      prompt,
      duration,
      state,
      filePath: u.replaceUrl(src),
      trackId,
      videoDesc,
      shouldGenerateImage: src ? 1 : 0,
      scriptId: scriptId,
      projectId: projectId,
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
    return res.status(200).send(success({ id }));
  },
);

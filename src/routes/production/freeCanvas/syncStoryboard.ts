import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";

const router = express.Router();

const itemSchema = z.object({
  id: z.string().optional(),
  prompt: z.string(),
  videoDesc: z.string().optional(),
  duration: z.number().optional(),
  track: z.string().optional(),
  state: z.string().optional(),
  src: z.string().nullable().optional(),
  shotType: z.string().optional().nullable(),
  cameraAngle: z.string().optional().nullable(),
  cameraMovement: z.string().optional().nullable(),
  composition: z.string().optional().nullable(),
  actorBlocking: z.string().optional().nullable(),
  emotionBeat: z.string().optional().nullable(),
  directorNote: z.string().optional().nullable(),
});

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    frames: z.array(itemSchema),
  }),
  async (req, res) => {
    const { projectId, scriptId, frames } = req.body;
    if (!frames.length) return res.status(400).send(error("没有可同步的分镜帧"));

    try {
      const inserted = [];
      for (const [index, frame] of frames.entries()) {
        const [trackId] = await u.db("o_videoTrack").insert({
          scriptId,
          projectId,
          duration: Number(frame.duration) || 5,
        });
        const [id] = await u.db("o_storyboard").insert({
          prompt: frame.prompt,
          duration: String(Number(frame.duration) || 5),
          state: frame.state || (frame.src ? "生成成功" : "未生成"),
          filePath: frame.src ? u.replaceUrl(frame.src) : null,
          trackId,
          track: frame.track || `自由画布-${index + 1}`,
          videoDesc: frame.videoDesc || frame.prompt,
          shouldGenerateImage: frame.src ? 0 : 1,
          scriptId,
          projectId,
          shotType: frame.shotType ?? null,
          cameraAngle: frame.cameraAngle ?? null,
          cameraMovement: frame.cameraMovement ?? null,
          composition: frame.composition ?? null,
          actorBlocking: frame.actorBlocking ?? null,
          emotionBeat: frame.emotionBeat ?? null,
          directorNote: frame.directorNote ?? null,
          createTime: Date.now(),
        });
        inserted.push({ id, trackId, canvasNodeId: frame.id });
      }
      return res.status(200).send(success({ inserted }));
    } catch (err: any) {
      return res.status(400).send(error(u.error(err).message));
    }
  },
);

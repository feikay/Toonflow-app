import express from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { urlToBase64 } from "@/lib/freeCanvas";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    prompt: z.string(),
    model: z.string().optional(),
    references: z.array(z.string()).optional(),
    mode: z.any().optional(),
    resolution: z.string().optional(),
    duration: z.number().optional(),
    audio: z.boolean().optional(),
    trackId: z.number().optional(),
  }),
  async (req, res) => {
    try {
      const { projectId, scriptId, prompt, references = [], audio } = req.body;
      const project = await u.db("o_project").where("id", projectId).first();
      const model = req.body.model || project?.videoModel;
      if (!model) return res.status(400).send(error("项目未配置视频模型"));

      const duration = req.body.duration || 5;
      const resolution = req.body.resolution || "720p";
      const rawMode = req.body.mode || (references.length ? "singleImage" : "text");
      let mode = Array.isArray(rawMode) ? rawMode : [rawMode];
      if (typeof rawMode === "string" && rawMode.startsWith("[") && rawMode.endsWith("]")) {
        try {
          mode = JSON.parse(rawMode);
        } catch {
          mode = [rawMode];
        }
      }
      const videoPath = `/${projectId}/video/${uuidv4()}.mp4`;
      let trackId = req.body.trackId;

      if (!trackId) {
        const [insertTrackId] = await u.db("o_videoTrack").insert({ projectId, scriptId, prompt, duration, state: "生成中" });
        trackId = insertTrackId;
      }

      const [videoId] = await u.db("o_video").insert({
        filePath: videoPath,
        time: Date.now(),
        state: "生成中",
        scriptId,
        projectId,
        videoTrackId: trackId,
      });

      res.status(200).send(success({ videoId, trackId }));

      (async () => {
        try {
          const base64 = await Promise.all(references.filter(Boolean).map((url: string) => urlToBase64(url)));
          const aiVideo = u.Ai.Video(model);
          await aiVideo.run(
            {
              prompt,
              referenceList: base64.map((item) => ({ type: "image" as const, base64: item })),
              mode,
              duration,
              aspectRatio: (project?.videoRatio as "16:9" | "9:16") || "16:9",
              resolution,
              audio,
            },
            {
              projectId,
              taskClass: "自由画布视频生成",
              describe: "自由画布节点图生视频/文生视频",
              relatedObjects: JSON.stringify({ projectId, scriptId, videoId, trackId, prompt, referenceCount: base64.length }),
            },
          );
          await aiVideo.save(videoPath);
          await u.db("o_video").where("id", videoId).update({ state: "生成成功" });
          await u.db("o_videoTrack").where("id", trackId).update({ state: "已完成", videoId });
        } catch (err: any) {
          const message = u.error(err).message;
          await u.db("o_video").where("id", videoId).update({ state: "生成失败", errorReason: message });
          await u.db("o_videoTrack").where("id", trackId).update({ state: "生成失败", reason: message });
        }
      })();
    } catch (err: any) {
      return res.status(400).send(error(u.error(err).message));
    }
  },
);

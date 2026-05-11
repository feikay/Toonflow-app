import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    videoId: z.number(),
  }),
  async (req, res) => {
    try {
      const video = await u.db("o_video").where("id", req.body.videoId).first();
      if (!video) return res.status(404).send(error("视频不存在"));
      return res.status(200).send(
        success({
          ...video,
          src: video.filePath ? await u.oss.getFileUrl(video.filePath) : "",
        }),
      );
    } catch (err: any) {
      return res.status(400).send(error(err?.message ?? "读取视频状态失败"));
    }
  },
);

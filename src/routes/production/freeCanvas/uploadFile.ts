import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { saveBase64ToFreeCanvas } from "@/lib/freeCanvas";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    base64Data: z.string(),
  }),
  async (req, res) => {
    try {
      const { projectId, scriptId, base64Data } = req.body;
      return res.status(200).send(success(await saveBase64ToFreeCanvas(projectId, scriptId, base64Data)));
    } catch (err: any) {
      return res.status(400).send(error(err?.message ?? "上传自由画布文件失败"));
    }
  },
);

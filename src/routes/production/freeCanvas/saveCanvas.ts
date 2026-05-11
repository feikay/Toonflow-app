import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { saveFreeCanvas } from "@/lib/freeCanvas";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    canvas: z.any(),
  }),
  async (req, res) => {
    try {
      const { projectId, scriptId, canvas } = req.body;
      return res.status(200).send(success(await saveFreeCanvas(projectId, scriptId, canvas)));
    } catch (err: any) {
      return res.status(400).send(error(err?.message ?? "保存自由画布失败"));
    }
  },
);

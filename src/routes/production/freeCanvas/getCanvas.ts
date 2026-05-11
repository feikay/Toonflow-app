import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { getFreeCanvas } from "@/lib/freeCanvas";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
  }),
  async (req, res) => {
    try {
      const { projectId, scriptId } = req.body;
      return res.status(200).send(success(await getFreeCanvas(projectId, scriptId)));
    } catch (err: any) {
      return res.status(400).send(error(err?.message ?? "读取自由画布失败"));
    }
  },
);

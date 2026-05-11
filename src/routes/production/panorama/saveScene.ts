import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number().optional().nullable(),
    projectId: z.number(),
    scriptId: z.number(),
    name: z.string(),
    prompt: z.string().optional().nullable(),
    aspectType: z.enum(["360", "720"]),
    url: z.string().optional().nullable(),
    imageId: z.number().optional().nullable(),
    width: z.number().optional().nullable(),
    height: z.number().optional().nullable(),
    meta: z.string().optional().nullable(),
  }),
  async (req, res) => {
    const { id, projectId, scriptId, name, prompt, aspectType, url, imageId, width, height, meta } = req.body;
    const now = Date.now();
    const payload = {
      projectId,
      scriptId,
      name,
      prompt: prompt ?? null,
      aspectType,
      filePath: url ? u.replaceUrl(url) : null,
      imageId: imageId ?? null,
      width: width ?? null,
      height: height ?? null,
      meta: meta ?? null,
      updateTime: now,
    };

    let sceneId = id;
    if (sceneId) {
      await u.db("o_panoramaScene").where({ id: sceneId }).update(payload);
    } else {
      const [insertId] = await u.db("o_panoramaScene").insert({
        ...payload,
        createTime: now,
      });
      sceneId = insertId;
    }

    const scene = await u.db("o_panoramaScene").where({ id: sceneId }).first();
    res.status(200).send(success(scene));
  },
);

import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
  }),
  async (req, res) => {
    const { id } = req.body;
    const scene = await u.db("o_panoramaScene").where({ id }).first();
    if (!scene) return res.status(404).send(error("未找到全景场景"));

    const hotspots = await u.db("o_panoramaHotspot").where({ panoramaSceneId: id }).orderBy("id", "asc");
    res.status(200).send(
      success({
        ...scene,
        url: scene.filePath ? await u.oss.getFileUrl(scene.filePath) : "",
        hotspots,
      }),
    );
  },
);

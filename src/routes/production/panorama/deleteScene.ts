import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
  }),
  async (req, res) => {
    const { id } = req.body;
    await u.db("o_panoramaHotspot").where({ panoramaSceneId: id }).delete();
    await u.db("o_panoramaScene").where({ id }).delete();
    await u
      .db("o_storyboard")
      .where({ panoramaSceneId: id })
      .update({
        panoramaSceneId: null,
        panoramaHotspotId: null,
        panoramaView: null,
      });
    res.status(200).send(success());
  },
);

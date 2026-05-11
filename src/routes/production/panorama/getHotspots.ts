import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    panoramaSceneId: z.number(),
  }),
  async (req, res) => {
    const { panoramaSceneId } = req.body;
    const data = await u.db("o_panoramaHotspot").where({ panoramaSceneId }).orderBy("id", "asc");
    res.status(200).send(success(data));
  },
);

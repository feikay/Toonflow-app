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
    hotspots: z.array(
      z.object({
        id: z.number().optional().nullable(),
        type: z.enum(["camera", "actor", "prop", "path"]),
        label: z.string().optional().nullable(),
        x: z.number(),
        y: z.number(),
        yaw: z.number().optional().nullable(),
        pitch: z.number().optional().nullable(),
        fov: z.number().optional().nullable(),
        meta: z.string().optional().nullable(),
      }),
    ),
  }),
  async (req, res) => {
    const { panoramaSceneId, hotspots } = req.body;
    const now = Date.now();

    await u.db("o_panoramaHotspot").where({ panoramaSceneId }).delete();
    if (hotspots.length) {
      await u.db("o_panoramaHotspot").insert(
        hotspots.map((item: any) => ({
          panoramaSceneId,
          type: item.type,
          label: item.label ?? null,
          x: item.x,
          y: item.y,
          yaw: item.yaw ?? null,
          pitch: item.pitch ?? null,
          fov: item.fov ?? null,
          meta: item.meta ?? null,
          createTime: now,
          updateTime: now,
        })),
      );
    }

    const data = await u.db("o_panoramaHotspot").where({ panoramaSceneId }).orderBy("id", "asc");
    res.status(200).send(success(data));
  },
);

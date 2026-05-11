import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number().optional().nullable(),
  }),
  async (req, res) => {
    const { projectId, scriptId } = req.body;
    const list = await u
      .db("o_panoramaScene")
      .where({ projectId })
      .modify((qb) => {
        if (scriptId) qb.andWhere("scriptId", scriptId);
      })
      .orderBy("updateTime", "desc");

    const data = await Promise.all(
      list.map(async (item: any) => ({
        ...item,
        url: item.filePath ? await u.oss.getFileUrl(item.filePath) : "",
      })),
    );
    res.status(200).send(success(data));
  },
);

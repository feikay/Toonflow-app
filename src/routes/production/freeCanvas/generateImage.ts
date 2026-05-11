import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { urlToBase64 } from "@/lib/freeCanvas";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    prompt: z.string(),
    model: z.string().optional(),
    references: z.array(z.string()).optional(),
    quality: z.string().optional(),
    ratio: z.string().optional(),
  }),
  async (req, res) => {
    try {
      const { projectId, scriptId, prompt, references = [] } = req.body;
      const project = await u.db("o_project").where("id", projectId).first();
      const model = req.body.model || project?.imageModel;
      if (!model) return res.status(400).send(error("项目未配置图片模型"));

      const imageClass = await u.Ai.Image(model).run(
        {
          prompt,
          referenceList: await Promise.all(references.filter(Boolean).map(async (url: string) => ({ type: "image" as const, base64: await urlToBase64(url) }))),
          size: req.body.quality || project?.imageQuality || "1K",
          aspectRatio: req.body.ratio || project?.videoRatio || "16:9",
        },
        {
          taskClass: "自由画布图片生成",
          describe: "自由画布节点图片生成",
          relatedObjects: JSON.stringify({ projectId, scriptId, prompt, references }),
          projectId,
        },
      );

      const savePath = `/${projectId}/freeCanvas/${scriptId}/${u.uuid()}.jpg`;
      await imageClass.save(savePath);
      return res.status(200).send(success({ url: await u.oss.getFileUrl(savePath), filePath: savePath }));
    } catch (err: any) {
      return res.status(400).send(error(u.error(err).message));
    }
  },
);

import express from "express";
import u from "@/utils";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

type Type = "imageReference" | "startImage" | "endImage" | "videoReference" | "audioReference";

interface UploadItem {
  fileType: "image" | "video" | "audio";
  type: Type;
  sources?: "assets" | "storyboard";
  id?: number;
  src?: string;
  label?: string;
  prompt?: string;
}

function uniqueStrings(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => !!item))];
}

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    uploadData: z.array(
      z.object({
        id: z.number(),
        sources: z.string(),
      }),
    ),
    prompt: z.string(),
    model: z.string(),
    mode: z.string(),
    resolution: z.string(),
    duration: z.number(),
    audio: z.boolean().optional(),
    trackId: z.number(),
  }),
  async (req, res) => {
    const { scriptId, projectId, prompt, uploadData, model, duration, resolution, audio, mode, trackId } = req.body;

    let modeData = [];
    if (Array.isArray(mode)) {
      modeData = mode;
    } else if (typeof mode === "string" && mode.startsWith('["') && mode.endsWith('"]')) {
      try {
        modeData = JSON.parse(mode);
      } catch {
        modeData = [];
      }
    }

    const ratio = await u.db("o_project").select("videoRatio").where("id", projectId).first();
    const videoPath = `/${projectId}/video/${uuidv4()}.mp4`;

    const imagePaths = await Promise.all(
      uploadData.map(async (item: UploadItem) => {
        if (item.sources === "storyboard") {
          const storyboard = await u
            .db("o_storyboard")
            .leftJoin("o_panoramaScene", "o_storyboard.panoramaSceneId", "o_panoramaScene.id")
            .leftJoin("o_image as panoramaImage", "o_panoramaScene.imageId", "panoramaImage.id")
            .where("o_storyboard.id", item.id)
            .select("o_storyboard.filePath as storyboardFilePath", "o_panoramaScene.filePath as panoramaFilePath", "panoramaImage.filePath as panoramaImageFilePath")
            .first();

          return uniqueStrings([
            storyboard?.storyboardFilePath,
            storyboard?.panoramaFilePath,
            storyboard?.panoramaImageFilePath,
          ]);
        }

        if (item.sources === "assets") {
          const asset = await u
            .db("o_assets")
            .where("o_assets.id", item.id)
            .leftJoin("o_image", "o_assets.imageId", "o_image.id")
            .select("o_image.filePath")
            .first();

          return uniqueStrings([asset?.filePath]);
        }

        return [];
      }),
    );

    const flatImagePaths = uniqueStrings(imagePaths.flat());
    const base64 = await Promise.all(
      flatImagePaths.map(async (item) => {
        return await u.oss.getImageBase64(item);
      }),
    );

    const [videoId] = await u.db("o_video").insert({
      filePath: videoPath,
      time: Date.now(),
      state: "生成中",
      scriptId,
      projectId,
      videoTrackId: trackId,
    });

    res.status(200).send(success(videoId));

    (async () => {
      try {
        const relatedObjects = {
          projectId,
          videoId,
          scriptId,
          type: "视频",
          referenceImageCount: flatImagePaths.length,
          referenceSources: uploadData,
        };

        const aiVideo = u.Ai.Video(model);
        await aiVideo.run(
          {
            prompt,
            referenceList: base64.map((item) => ({ type: "image" as const, base64: item })),
            mode: modeData.length > 0 ? modeData : mode,
            duration,
            aspectRatio: (ratio?.videoRatio as "16:9" | "9:16") || "16:9",
            resolution,
            audio,
          },
          {
            projectId,
            taskClass: "视频生成",
            describe: "根据提示词生成视频",
            relatedObjects: JSON.stringify(relatedObjects),
          },
        );

        await aiVideo.save(videoPath);
        await u.db("o_video").where("id", videoId).update({ state: "生成成功" });
      } catch (error: any) {
        await u.db("o_video").where("id", videoId).update({
          state: "生成失败",
          errorReason: u.error(error).message,
        });
      }
    })();
  },
);

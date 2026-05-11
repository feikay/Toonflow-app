import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";

const router = express.Router();

interface SplitShot {
  index: number;
  title: string;
  story: string;
  prompt: string;
  videoDesc: string;
  duration: number;
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  composition: string;
  actorBlocking: string;
  emotionBeat: string;
  directorNote: string;
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced || text.match(/\[[\s\S]*\]/)?.[0] || text.match(/\{[\s\S]*\}/)?.[0] || text;
  return JSON.parse(raw);
}

function fallbackSplit(script: string, targetCount: number): SplitShot[] {
  const clean = script.replace(/\s+/g, " ").trim();
  const parts = clean
    .split(/(?<=[。！？!?；;])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  const count = Math.max(6, Math.min(9, targetCount || Math.min(9, Math.max(6, parts.length || 6))));
  const buckets = Array.from({ length: count }, (_, index) => parts.filter((_, itemIndex) => itemIndex % count === index).join(" ") || clean);
  return buckets.map((story, index) => ({
    index: index + 1,
    title: `镜头 ${index + 1}`,
    story,
    prompt: story,
    videoDesc: story,
    duration: 5,
    shotType: index === 0 ? "建立镜头" : "中景",
    cameraAngle: "平视",
    cameraMovement: index % 3 === 0 ? "缓慢推进" : "固定镜头",
    composition: "主体清晰，背景服务叙事",
    actorBlocking: "角色动作与情绪匹配剧情",
    emotionBeat: "承接上一镜头情绪",
    directorNote: "",
  }));
}

function normalizeShot(item: any, index: number): SplitShot {
  return {
    index: Number(item.index) || index + 1,
    title: String(item.title || item.name || `镜头 ${index + 1}`),
    story: String(item.story || item.content || item.scene || item.videoDesc || item.prompt || ""),
    prompt: String(item.prompt || item.imagePrompt || item.story || item.videoDesc || ""),
    videoDesc: String(item.videoDesc || item.videoPrompt || item.story || item.prompt || ""),
    duration: Number(item.duration) || 5,
    shotType: String(item.shotType || item.shot || "中景"),
    cameraAngle: String(item.cameraAngle || item.angle || "平视"),
    cameraMovement: String(item.cameraMovement || item.movement || "固定镜头"),
    composition: String(item.composition || "主体清晰，构图稳定"),
    actorBlocking: String(item.actorBlocking || item.blocking || "按剧情调度角色"),
    emotionBeat: String(item.emotionBeat || item.emotion || "明确情绪节拍"),
    directorNote: String(item.directorNote || item.note || ""),
  };
}

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    script: z.string(),
    targetCount: z.number().optional(),
  }),
  async (req, res) => {
    const { projectId, scriptId, script } = req.body;
    const targetCount = Math.max(6, Math.min(9, Number(req.body.targetCount) || 8));

    try {
      const prompt = `你是短剧分镜导演。请把下面剧情自动拆成 ${targetCount} 个连续镜头，只返回 JSON 数组，不要解释。
每个元素必须包含：
index,title,story,prompt,videoDesc,duration,shotType,cameraAngle,cameraMovement,composition,actorBlocking,emotionBeat,directorNote。
要求：镜头连续、每镜头可直接用于 AI 绘图和图生视频；prompt 写画面，不写抽象总结；videoDesc 写视频动作和运镜。

剧情：
${script}`;

      const { text } = await u.Ai.Text("universalAi").invoke({
        prompt,
        temperature: 0.4,
      });
      const parsed = extractJson(text);
      const list = Array.isArray(parsed) ? parsed : parsed.shots || parsed.storyboard || [];
      const shots = list.slice(0, 9).map(normalizeShot).filter((item: SplitShot) => item.prompt || item.story);
      return res.status(200).send(success({ shots: shots.length ? shots : fallbackSplit(script, targetCount), projectId, scriptId }));
    } catch (err: any) {
      return res.status(200).send(success({ shots: fallbackSplit(script, targetCount), warning: u.error(err).message, projectId, scriptId }));
    }
  },
);

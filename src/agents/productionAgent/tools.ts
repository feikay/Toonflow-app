import { tool, Tool } from "ai";
import { z } from "zod";
import ResTool from "@/socket/resTool";
import u from "@/utils";

const deriveAssetSchema = z.object({
  id: z.number().describe("衍生资产ID，如为新增可为空"),
  assetsId: z.number().describe("关联的母资产ID"),
  prompt: z.string().describe("生成提示词"),
  name: z.string().describe("衍生资产名称"),
  desc: z.string().describe("衍生资产描述"),
  src: z.string().nullable().describe("衍生资产资源路径"),
  state: z.enum(["未生成", "生成中", "已完成", "生成失败"]).describe("衍生资产生成状态"),
  type: z.enum(["role", "tool", "scene", "clip"]).describe("衍生资产类型"),
});

export const assetItemSchema = z.object({
  id: z.number().describe("资产唯一标识"),
  name: z.string().describe("资产名称"),
  type: z.enum(["role", "tool", "scene", "clip"]).describe("资产类型"),
  prompt: z.string().describe("生成提示词"),
  desc: z.string().describe("资产描述"),
  derive: z.array(deriveAssetSchema).describe("衍生资产列表"),
});

const storyboardSchema = z.object({
  id: z.number().describe("分镜ID，必须为真实ID"),
  duration: z.number().describe("持续时长（秒）"),
  prompt: z.string().describe("生成提示词"),
  associateAssetsIds: z.array(z.number()).describe("关联资产ID列表"),
  src: z.string().nullable().describe("分镜资源路径"),
  index: z.number().nullable().optional().describe("分镜排序字段"),
  shotType: z.string().nullable().optional().describe("景别"),
  cameraAngle: z.string().nullable().optional().describe("机位角度"),
  cameraMovement: z.string().nullable().optional().describe("运镜方式"),
  composition: z.string().nullable().optional().describe("构图方式"),
  actorBlocking: z.string().nullable().optional().describe("角色调度"),
  emotionBeat: z.string().nullable().optional().describe("情绪节拍"),
  directorNote: z.string().nullable().optional().describe("导演备注"),
  panoramaSceneId: z.number().nullable().optional().describe("关联全景场景ID"),
  panoramaHotspotId: z.number().nullable().optional().describe("关联全景热点ID"),
  panoramaView: z.string().nullable().optional().describe("全景取景窗口"),
  lensPreset: z.string().nullable().optional().describe("镜头预设"),
});

const panoramaHotspotSchema = z.object({
  id: z.number().describe("全景热点ID"),
  panoramaSceneId: z.number().describe("所属全景场景ID"),
  type: z.string().nullable().optional().describe("热点类型"),
  label: z.string().nullable().optional().describe("热点名称"),
  x: z.number().nullable().optional().describe("热点X坐标"),
  y: z.number().nullable().optional().describe("热点Y坐标"),
  yaw: z.number().nullable().optional().describe("水平角"),
  pitch: z.number().nullable().optional().describe("俯仰角"),
  fov: z.number().nullable().optional().describe("视野角"),
  meta: z.string().nullable().optional().describe("扩展信息"),
});

const panoramaSceneSchema = z.object({
  id: z.number().describe("全景场景ID"),
  projectId: z.number().describe("项目ID"),
  scriptId: z.number().describe("剧本ID"),
  name: z.string().describe("全景场景名称"),
  prompt: z.string().nullable().optional().describe("全景场景提示词"),
  aspectType: z.enum(["360", "720"]).describe("全景比例"),
  src: z.string().nullable().optional().describe("全景场景图片路径"),
  imageId: z.number().nullable().optional().describe("全景图片ID"),
  width: z.number().nullable().optional().describe("图片宽度"),
  height: z.number().nullable().optional().describe("图片高度"),
  meta: z.string().nullable().optional().describe("扩展信息"),
  hotspots: z.array(panoramaHotspotSchema).describe("热点列表"),
});

export const flowDataSchema = z.object({
  script: z.string().describe("剧本内容"),
  scriptPlan: z.string().describe("拍摄计划"),
  assets: z.array(assetItemSchema).describe("衍生资产"),
  storyboardTable: z.string().describe("分镜表"),
  storyboard: z.array(storyboardSchema).describe("分镜面板"),
  panoramaScenes: z.array(panoramaSceneSchema).describe("全景场景母板"),
});

export type FlowData = z.infer<typeof flowDataSchema>;

const keySchema = z.enum(Object.keys(flowDataSchema.shape) as [keyof FlowData, ...Array<keyof FlowData>]);
const flowDataKeyLabels = Object.fromEntries(
  Object.entries(flowDataSchema.shape).map(([key, schema]) => [key, (schema as z.ZodTypeAny).description ?? key]),
) as Record<keyof FlowData, string>;

interface ToolConfig {
  resTool: ResTool;
  toolsNames?: string[];
  msg: ReturnType<ResTool["newMessage"]>;
}

export default (toolConfig: ToolConfig) => {
  const { resTool, toolsNames, msg } = toolConfig;
  const { socket } = resTool;

  const tools: Record<string, Tool> = {
    get_flowData: tool({
      description: "获取工作区数据",
      inputSchema: z.object({
        key: keySchema.describe("数据Key"),
      }),
      execute: async ({ key }) => {
        const thinking = msg.thinking(`正在获取${flowDataKeyLabels[key]}工作区数据...`);
        console.log("[tools] get_flowData", key);
        const flowData: FlowData = await new Promise((resolve) => socket.emit("getFlowData", { key }, (res: any) => resolve(res)));
        thinking.appendText(`获取到${flowDataKeyLabels[key]}:\n` + JSON.stringify(flowData[key], null, 2));
        thinking.updateTitle(`获取${flowDataKeyLabels[key]}完成`);
        thinking.complete();
        return flowData[key];
      },
    }),
    add_deriveAsset: tool({
      description: "新增或更新衍生资产",
      inputSchema: z.object({
        assetsId: z.number().describe("关联的资产ID"),
        id: z.preprocess(
          (val) => {
            if (val === "null" || val === "" || val === undefined) return null;
            return val;
          },
          z.number().nullable().describe("衍生资产ID，如为新增则为空"),
        ),
        name: z.string().describe("衍生资产名称"),
        desc: z.string().describe("衍生资产描述"),
      }),
      execute: async (deriveAsset) => {
        const thinking = msg.thinking("正在操作资产...");
        const { projectId, scriptId } = resTool.data;
        const startTime = Date.now();
        const parentAssets = await u.db("o_assets").where("id", deriveAsset.assetsId).select("id", "type").first();
        if (!parentAssets) return "关联的资产不存在";

        const data: Record<string, any> = {
          id: deriveAsset.id ?? undefined,
          assetsId: deriveAsset.assetsId,
          projectId,
          name: deriveAsset.name,
          type: parentAssets.type,
          describe: deriveAsset.desc,
          startTime,
        };
        if (deriveAsset.id) {
          await u.db("o_assets").where("id", deriveAsset.id).update(data);
          thinking.appendText(`已更新衍生资产，ID: ${deriveAsset.id}\n`);
        } else {
          const [insertedId] = await u.db("o_assets").insert(data);
          data.id = insertedId;
          await u.db("o_scriptAssets").insert({ scriptId, assetId: insertedId });
          thinking.appendText(`已新增衍生资产，ID: ${insertedId}\n`);
        }
        const res = await new Promise((resolve) => socket.emit("addDeriveAsset", data, (response: any) => resolve(response)));
        thinking.updateTitle("资产操作完成");
        thinking.complete();
        return res ?? "操作成功";
      },
    }),
    del_deriveAsset: tool({
      description: "删除衍生资产",
      inputSchema: z.object({
        assetsId: z.number().describe("关联的资产ID"),
        id: z.number().describe("衍生资产ID"),
      }),
      execute: async ({ assetsId, id }) => {
        const thinking = msg.thinking("正在操作资产...");
        const { scriptId } = resTool.data;
        await u.db("o_assets").where("id", id).del();
        await u.db("o_scriptAssets").where({ scriptId, assetId: id }).del();
        thinking.appendText(`已删除衍生资产，ID: ${id}\n`);
        const res = await new Promise((resolve) => socket.emit("delDeriveAsset", { assetsId, id }, (response: any) => resolve(response)));
        thinking.updateTitle("资产操作完成");
        thinking.complete();
        return res ?? "删除成功";
      },
    }),
    generate_deriveAsset: tool({
      description: "生成衍生资产图片",
      inputSchema: z.object({
        ids: z.array(z.number()).describe("需要生成的衍生资产ID"),
      }),
      execute: async ({ ids }) => {
        const thinking = msg.thinking("正在生成衍生资产...");
        new Promise((resolve) => socket.emit("generateDeriveAsset", { ids }, (response: any) => resolve(response)))
          .then((response) => {
            thinking.appendText(`已开始生成衍生资产，返回数据:\n${JSON.stringify(response, null, 2)}\n`);
            thinking.updateTitle("衍生资产生成已启动");
            thinking.complete();
          })
          .catch((e) => {
            thinking.appendText("衍生资产生成失败:\n" + u.error(e).message);
            thinking.updateTitle("衍生资产生成失败");
            thinking.complete();
          });

        return "已开始生成衍生资产";
      },
    }),
    generate_storyboard: tool({
      description: "生成分镜图片",
      inputSchema: z.object({
        ids: z.array(z.number()).describe("必须获取真实的分镜ID，支持批量生成"),
      }),
      execute: async ({ ids }) => {
        const thinking = msg.thinking("正在生成分镜...");
        new Promise((resolve) => socket.emit("generateStoryboard", { ids }, (response: any) => resolve(response)))
          .then((response) => {
            thinking.appendText("生成的分镜数据:\n" + JSON.stringify(response, null, 2));
            thinking.updateTitle("分镜生成完成");
            thinking.complete();
          })
          .catch((e) => {
            thinking.appendText("分镜生成失败:\n" + u.error(e).message);
            thinking.updateTitle("分镜生成失败");
            thinking.complete();
          });

        return "已开始生成分镜";
      },
    }),
  };

  return toolsNames ? Object.fromEntries(Object.entries(tools).filter(([name]) => toolsNames.includes(name))) : tools;
};

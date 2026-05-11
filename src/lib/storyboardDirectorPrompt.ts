interface DirectorPromptInput {
  prompt?: string | null;
  shotType?: string | null;
  cameraAngle?: string | null;
  cameraMovement?: string | null;
  composition?: string | null;
  actorBlocking?: string | null;
  emotionBeat?: string | null;
  directorNote?: string | null;
  panoramaView?: string | null;
  lensPreset?: string | null;
}

interface PanoramaScenePromptInput {
  name?: string | null;
  prompt?: string | null;
  aspectType?: string | null;
  meta?: string | null;
  imageId?: number | null;
}

interface PanoramaHotspotPromptInput {
  label?: string | null;
  type?: string | null;
  yaw?: number | null;
  pitch?: number | null;
  fov?: number | null;
  meta?: string | null;
}

function pushLine(lines: string[], label: string, value?: string | null) {
  const text = value?.trim();
  if (text) lines.push(`${label}：${text}`);
}

export function buildStoryboardDirectorPrompt(
  storyboard: DirectorPromptInput,
  panoramaScene?: PanoramaScenePromptInput | null,
  panoramaHotspot?: PanoramaHotspotPromptInput | null,
) {
  const basePrompt = storyboard.prompt?.trim() ?? "";
  const directives: string[] = [];

  pushLine(directives, "景别", storyboard.shotType);
  pushLine(directives, "机位角度", storyboard.cameraAngle);
  pushLine(directives, "运镜方式", storyboard.cameraMovement);
  pushLine(directives, "构图方式", storyboard.composition);
  pushLine(directives, "角色调度", storyboard.actorBlocking);
  pushLine(directives, "情绪节拍", storyboard.emotionBeat);
  pushLine(directives, "导演备注", storyboard.directorNote);
  pushLine(directives, "全景取景", storyboard.panoramaView);
  pushLine(directives, "镜头预设", storyboard.lensPreset);

  if (panoramaScene) {
    const sceneName = panoramaScene.name?.trim() || "未命名场景";
    const aspectType = panoramaScene.aspectType?.trim();
    directives.push(`场景母板：${sceneName}${aspectType ? `（${aspectType}）` : ""}`);
    pushLine(directives, "母板场景描述", panoramaScene.prompt);
    pushLine(directives, "母板扩展信息", panoramaScene.meta);
  }

  if (panoramaHotspot) {
    pushLine(directives, "母板机位名称", panoramaHotspot.label);
    pushLine(directives, "母板机位类型", panoramaHotspot.type);
    if (panoramaHotspot.yaw != null) directives.push(`母板水平角：${panoramaHotspot.yaw}`);
    if (panoramaHotspot.pitch != null) directives.push(`母板俯仰角：${panoramaHotspot.pitch}`);
    if (panoramaHotspot.fov != null) directives.push(`母板视野角：${panoramaHotspot.fov}`);
    pushLine(directives, "母板热点扩展信息", panoramaHotspot.meta);
  }

  if (!directives.length) return basePrompt;

  const directorBlock = ["请严格遵守以下导演约束生成画面：", ...directives.map((item) => `- ${item}`)].join("\n");
  return [basePrompt, directorBlock].filter(Boolean).join("\n\n");
}

export function mergeStoryboardReferenceImageIds(assetImageIds: number[], panoramaScene?: PanoramaScenePromptInput | null) {
  const ids = panoramaScene?.imageId ? [panoramaScene.imageId, ...assetImageIds] : [...assetImageIds];
  return [...new Set(ids.filter((id): id is number => Number.isFinite(id)))];
}

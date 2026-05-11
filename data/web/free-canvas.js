(function () {
  if (window.__TOONFLOW_FREE_CANVAS_COPILOT__) return;
  window.__TOONFLOW_FREE_CANVAS_COPILOT__ = true;

  const VERSION = "copilot-workbench-20260510";
  const NODE_W = 268;
  const NODE_MIN_H = 146;
  const ZOOM_MIN = 0.18;
  const ZOOM_MAX = 2.6;

  const NODE_TYPES = {
    scriptSplit: { title: "剧情拆分", group: "分镜", badge: "拆", color: "#3b82f6", icon: "split", desc: "一键把一段剧情拆成 6-9 个镜头" },
    storyboardFrame: { title: "分镜帧", group: "分镜", badge: "镜", color: "#2563eb", icon: "frame", desc: "单个镜头，可改图、接视频、同步回分镜表" },
    image: { title: "上传图片", group: "素材", badge: "图", color: "#0f766e", icon: "upload", desc: "上传图片或视频作为参考素材" },
    text2image: { title: "文生图", group: "生成", badge: "文", color: "#7c3aed", icon: "spark", desc: "只用提示词生成图片" },
    image2image: { title: "图生图", group: "生成", badge: "改", color: "#0891b2", icon: "edit", desc: "接入参考图后生成新图片" },
    image2video: { title: "图生视频", group: "生成", badge: "视", color: "#dc2626", icon: "video", desc: "接图或文案生成视频，并写入视频轨道" },
    director: { title: "导演台", group: "导演", badge: "导", color: "#9333ea", icon: "camera", desc: "镜头、机位、运动、构图和情绪调度" },
    actor: { title: "角色占位", group: "导演", badge: "人", color: "#16a34a", icon: "actor", desc: "假人/角色站位、姿势、视线和动作占位" },
    panorama: { title: "全景节点", group: "全景", badge: "360", color: "#ea580c", icon: "pano", desc: "上传 360/720 全景图，拖动预览并截 4/9 宫格" },
    group: { title: "场次分组", group: "组织", badge: "组", color: "#475569", icon: "group", desc: "把一组镜头圈成一个场次" },
    note: { title: "文字备注", group: "组织", badge: "注", color: "#64748b", icon: "text", desc: "画布上的说明、提醒、导演备注" },
  };

  const DEFAULT_CANVAS = () => ({
    nodes: [],
    edges: [],
    viewport: { x: 48, y: 72, zoom: 1 },
    meta: { version: VERSION, source: "toonflow-free-canvas" },
    updatedAt: 0,
  });

  const state = {
    open: false,
    projectId: null,
    scriptId: null,
    token: "",
    canvas: DEFAULT_CANVAS(),
    selectedId: null,
    connectingFrom: null,
    menu: null,
    saving: false,
    saveTimer: null,
    history: [],
    future: [],
    status: "自由画布准备就绪",
    models: { image: [], video: [] },
    modelLoaded: false,
    videoPollTimers: new Map(),
    pointer: null,
    toolDialog: null,
    directorStudio: null,
    directorInlineStudios: new Map(),
    panoramaViewers: new Map(),
  };

  const root = document.createElement("div");
  root.id = "toonflow-free-canvas-root";
  document.body.appendChild(root);

  const style = document.createElement("style");
  style.textContent = `
    #toonflow-free-canvas-root, #toonflow-free-canvas-root * { box-sizing: border-box; letter-spacing: 0; }
    .tf-fc-launch { position: fixed; right: 22px; bottom: 84px; z-index: 2147482500; height: 42px; padding: 0 16px; border: 1px solid #111827; border-radius: 8px; background: #111827; color: #fff; font: 700 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif; box-shadow: 0 14px 32px rgba(15,23,42,.22); cursor: pointer; }
    .tf-fc-quick-save { position: fixed; right: 22px; bottom: 136px; z-index: 2147482500; height: 36px; padding: 0 13px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; color: #111827; font: 700 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif; box-shadow: 0 8px 20px rgba(15,23,42,.13); cursor: pointer; }
    .tf-fc-shell { position: fixed; inset: 0; z-index: 2147482600; background: #eef2f7; color: #111827; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif; overflow: hidden; }
    .tf-fc-topbar { position: absolute; top: 14px; left: 14px; right: 14px; z-index: 15; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; pointer-events: none; }
    .tf-fc-brand, .tf-fc-toolbar, .tf-fc-statusbar { pointer-events: auto; display: flex; align-items: center; gap: 8px; min-width: 0; border: 1px solid rgba(148,163,184,.45); border-radius: 8px; background: rgba(255,255,255,.94); box-shadow: 0 12px 34px rgba(15,23,42,.13); backdrop-filter: blur(10px); }
    .tf-fc-brand { height: 42px; padding: 0 10px; }
    .tf-fc-title { font-size: 14px; font-weight: 850; white-space: nowrap; }
    .tf-fc-chip { height: 24px; display: inline-flex; align-items: center; border-radius: 999px; padding: 0 8px; border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .tf-fc-toolbar { justify-self: center; height: 44px; padding: 5px; }
    .tf-fc-statusbar { justify-self: end; height: 42px; padding: 0 10px; max-width: 410px; }
    .tf-fc-status { color: #475569; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
    .tf-fc-btn { height: 32px; min-width: 32px; border: 1px solid #d1d5db; border-radius: 7px; background: #fff; color: #111827; padding: 0 10px; font-size: 13px; font-weight: 750; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
    .tf-fc-btn.icon { padding: 0; width: 32px; }
    .tf-fc-btn:hover { background: #f8fafc; border-color: #94a3b8; }
    .tf-fc-btn.primary { border-color: #2563eb; background: #2563eb; color: #fff; }
    .tf-fc-btn.danger { color: #b91c1c; border-color: #fecaca; }
    .tf-fc-btn:disabled { opacity: .46; cursor: not-allowed; }
    .tf-fc-id { height: 28px; display: flex; align-items: center; gap: 5px; font-size: 12px; color: #475569; white-space: nowrap; }
    .tf-fc-id input { width: 70px; height: 28px; border: 1px solid #d1d5db; border-radius: 6px; padding: 0 7px; color: #111827; font-size: 12px; background: #fff; }
    .tf-fc-stage { position: absolute; inset: 0; overflow: hidden; cursor: grab; background-color: #111318; background-image: radial-gradient(rgba(255,255,255,.12) 1px, transparent 1px); background-size: 22px 22px; }
    .tf-fc-stage.dragging { cursor: grabbing; }
    .tf-fc-canvas { position: absolute; left: 0; top: 0; width: 1px; height: 1px; transform-origin: 0 0; }
    .tf-fc-edges { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none; }
    .tf-fc-edge { stroke: rgba(255,255,255,.54); stroke-width: 2.2; fill: none; marker-end: url(#tf-fc-arrow); }
    .tf-fc-node { position: absolute; width: ${NODE_W}px; min-height: ${NODE_MIN_H}px; background: #1b1d24; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; box-shadow: 0 18px 44px rgba(0,0,0,.34); overflow: visible; cursor: default; color: #f8fafc; }
    .tf-fc-node.image-like { width: 360px; min-height: 245px; }
    .tf-fc-node.text-like { width: 320px; min-height: 160px; }
    .tf-fc-node.selected { border-color: rgba(99,102,241,.95); box-shadow: 0 0 0 2px rgba(99,102,241,.32), 0 24px 54px rgba(0,0,0,.44); }
    .tf-fc-node-head { height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border-bottom: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.035); cursor: grab; user-select: none; border-radius: 10px 10px 0 0; }
    .tf-fc-node-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 850; color: #f8fafc; }
    .tf-fc-badge { min-width: 30px; height: 20px; border-radius: 5px; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 850; padding: 0 5px; }
    .tf-fc-node-body { padding: 10px; display: grid; gap: 8px; }
    .tf-fc-thumb { height: 92px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: #15171d center/cover no-repeat; color: #a1a1aa; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 12px; overflow: hidden; }
    .tf-fc-thumb.large { height: 190px; }
    .tf-fc-thumb video, .tf-fc-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .tf-fc-dropzone { height: 190px; border: 1px dashed rgba(255,255,255,.24); border-radius: 8px; display: grid; place-items: center; padding: 18px; text-align: center; color: #a1a1aa; background: rgba(255,255,255,.025); }
    .tf-fc-dropzone strong { display: block; color: #f8fafc; margin-bottom: 5px; }
    .tf-fc-node-tools { position: absolute; left: 50%; top: -42px; transform: translateX(-50%); z-index: 5; display: none; align-items: center; gap: 6px; padding: 5px; border: 1px solid rgba(255,255,255,.15); border-radius: 999px; background: rgba(20,20,24,.92); box-shadow: 0 14px 34px rgba(0,0,0,.42); backdrop-filter: blur(10px); }
    .tf-fc-node.selected .tf-fc-node-tools { display: flex; }
    .tf-fc-tool-btn { height: 28px; min-width: 28px; border: 0; border-radius: 999px; background: transparent; color: #f8fafc; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 0 8px; font-size: 12px; font-weight: 800; cursor: pointer; }
    .tf-fc-tool-btn:hover { background: rgba(255,255,255,.12); }
    .tf-fc-tool-btn.danger { color: #fecaca; }
    .tf-fc-tool-sep { width: 1px; height: 18px; background: rgba(255,255,255,.14); }
    .tf-fc-prompt-inline { min-height: 64px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: rgba(0,0,0,.18); color: #f8fafc; padding: 8px; font-size: 12px; line-height: 1.5; outline: none; resize: vertical; }
    .tf-fc-control-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .tf-fc-chip-dark { height: 25px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: rgba(255,255,255,.055); color: #d4d4d8; padding: 0 8px; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; }
    .tf-fc-pano { cursor: ew-resize; background-size: 220% 120%; }
    .tf-fc-visual { position: relative; height: 138px; border-radius: 7px; border: 1px solid #dbe3ef; overflow: hidden; background: linear-gradient(180deg,#eef6ff 0%,#f8fafc 58%,#e2e8f0 59%,#dbe5ef 100%); }
    .tf-fc-visual.has-bg { background-size: cover; background-position: center; }
    .tf-fc-frame-guide { position: absolute; inset: 16px 24px; border: 2px solid rgba(37,99,235,.72); box-shadow: inset 0 0 0 1px rgba(255,255,255,.55); }
    .tf-fc-frame-guide:before, .tf-fc-frame-guide:after { content: ""; position: absolute; background: rgba(37,99,235,.5); }
    .tf-fc-frame-guide:before { left: 33%; top: 0; bottom: 0; width: 1px; box-shadow: 54px 0 0 rgba(37,99,235,.5); }
    .tf-fc-frame-guide:after { top: 33%; left: 0; right: 0; height: 1px; box-shadow: 0 31px 0 rgba(37,99,235,.5); }
    .tf-fc-camera-path { position: absolute; left: 28px; right: 28px; bottom: 18px; height: 26px; border-bottom: 2px dashed rgba(147,51,234,.65); transform: skewX(-18deg); }
    .tf-fc-stick { position: absolute; left: 50%; top: 28px; width: 58px; height: 92px; transform-origin: 50% 70%; }
    .tf-fc-stick .head { position: absolute; left: 21px; top: 0; width: 18px; height: 18px; border: 3px solid #111827; border-radius: 50%; background: rgba(255,255,255,.72); }
    .tf-fc-stick .body { position: absolute; left: 29px; top: 18px; width: 3px; height: 38px; background: #111827; }
    .tf-fc-stick .arm { position: absolute; left: 12px; top: 30px; width: 36px; height: 3px; background: #111827; transform-origin: 50% 50%; }
    .tf-fc-stick .leg-l, .tf-fc-stick .leg-r { position: absolute; left: 29px; top: 53px; width: 3px; height: 35px; background: #111827; transform-origin: 50% 0; }
    .tf-fc-stick .leg-l { transform: rotate(23deg); }
    .tf-fc-stick .leg-r { transform: rotate(-23deg); }
    .tf-fc-pano-large { height: 150px; background-size: 240% 135%; cursor: grab; }
    .tf-fc-vr-host { position: relative; height: 190px; min-height: 190px; border-radius: 8px; border: 1px solid #dbe3ef; overflow: hidden; background: #020617; cursor: grab; }
    .tf-vr-root { position: relative; width: 100%; height: 100%; min-height: 150px; overflow: hidden; background: #020617; color: #fff; user-select: none; }
    .tf-vr-canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; display: block; cursor: grab; }
    .tf-vr-loading { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; background: rgba(2,6,23,.82); color: rgba(255,255,255,.72); font-size: 12px; font-weight: 800; }
    .tf-vr-menu { position: absolute; right: 8px; top: 8px; z-index: 4; display: grid; gap: 6px; }
    .tf-vr-menu button { min-height: 28px; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: rgba(2,6,23,.62); color: rgba(255,255,255,.9); padding: 0 9px; font-size: 12px; font-weight: 800; cursor: pointer; backdrop-filter: blur(12px); }
    .tf-vr-menu button:hover { background: rgba(255,255,255,.14); }
    .tf-vr-hud { position: absolute; left: 8px; bottom: 8px; z-index: 4; display: grid; gap: 2px; color: rgba(255,255,255,.58); font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-size: 10px; font-weight: 800; pointer-events: none; }
    .tf-vr-crosshair { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; pointer-events: none; opacity: .18; }
    .tf-vr-crosshair span { width: 42px; height: 1px; background: #fff; grid-area: 1 / 1; }
    .tf-vr-crosshair b { width: 1px; height: 42px; background: #fff; grid-area: 1 / 1; }
    .tf-vr-crosshair i { width: 14px; height: 14px; border: 1px solid #fff; border-radius: 999px; grid-area: 1 / 1; }
    .tf-fc-visual-label { position: absolute; left: 8px; top: 8px; height: 22px; display: inline-flex; align-items: center; padding: 0 7px; border-radius: 999px; background: rgba(15,23,42,.72); color: #fff; font-size: 11px; font-weight: 800; }
    .tf-fc-small { color: #64748b; font-size: 12px; line-height: 1.45; word-break: break-word; }
    .tf-fc-node-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .tf-fc-mini-chip { min-height: 22px; display: inline-flex; align-items: center; border: 1px solid #e2e8f0; border-radius: 999px; background: #f8fafc; color: #475569; font-size: 11px; font-weight: 700; padding: 0 7px; max-width: 100%; }
    .tf-fc-handle { position: absolute; top: 50%; width: 14px; height: 28px; transform: translateY(-50%); border: 1px solid #cbd5e1; background: #fff; border-radius: 999px; cursor: crosshair; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 10px; }
    .tf-fc-handle.in { left: -8px; }
    .tf-fc-handle.out { right: -8px; }
    .tf-fc-handle.active { color: #fff; background: #2563eb; border-color: #2563eb; }
    .tf-fc-selected-actions { position: absolute; z-index: 14; display: flex; align-items: center; gap: 5px; height: 34px; padding: 3px; border: 1px solid rgba(148,163,184,.5); border-radius: 8px; background: rgba(255,255,255,.96); box-shadow: 0 10px 24px rgba(15,23,42,.16); }
    .tf-fc-inspector { position: absolute; top: 72px; right: 14px; bottom: 14px; z-index: 13; width: 342px; display: flex; flex-direction: column; border: 1px solid rgba(148,163,184,.5); border-radius: 8px; background: rgba(255,255,255,.96); box-shadow: 0 18px 44px rgba(15,23,42,.16); overflow: hidden; backdrop-filter: blur(10px); }
    .tf-fc-inspector-head { height: 45px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 12px; border-bottom: 1px solid #e5e7eb; }
    .tf-fc-inspector-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 850; }
    .tf-fc-inspector-body { padding: 12px; overflow: auto; display: grid; gap: 10px; }
    .tf-fc-empty { color: #64748b; font-size: 13px; line-height: 1.7; padding: 6px 2px; }
    .tf-fc-field { display: grid; gap: 5px; }
    .tf-fc-field label { font-size: 12px; font-weight: 800; color: #334155; }
    .tf-fc-field input, .tf-fc-field textarea, .tf-fc-field select { width: 100%; border: 1px solid #d1d5db; border-radius: 7px; background: #fff; color: #111827; font-size: 13px; padding: 7px 8px; outline: none; }
    .tf-fc-field textarea { min-height: 76px; resize: vertical; line-height: 1.5; }
    .tf-fc-field input:focus, .tf-fc-field textarea:focus, .tf-fc-field select:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,.12); }
    .tf-fc-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .tf-fc-ops { display: flex; flex-wrap: wrap; gap: 7px; }
    .tf-fc-menu { position: absolute; z-index: 30; width: 248px; border: 1px solid rgba(148,163,184,.55); border-radius: 8px; background: rgba(17,24,39,.96); color: #f8fafc; box-shadow: 0 18px 44px rgba(15,23,42,.32); overflow: hidden; padding: 5px; }
    .tf-fc-menu button { width: 100%; min-height: 46px; display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: center; border: 0; border-radius: 7px; background: transparent; color: inherit; padding: 7px 9px; text-align: left; cursor: pointer; }
    .tf-fc-menu button:hover { background: rgba(255,255,255,.08); }
    .tf-fc-menu-icon { width: 32px; height: 32px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.08); }
    .tf-fc-menu-title { display: block; font-size: 13px; font-weight: 850; }
    .tf-fc-menu-desc { display: block; color: #cbd5e1; font-size: 11px; line-height: 1.35; margin-top: 2px; }
    .tf-fc-minimap { position: absolute; left: 14px; bottom: 14px; z-index: 12; width: 166px; height: 112px; border: 1px solid rgba(148,163,184,.55); border-radius: 8px; background: rgba(255,255,255,.92); box-shadow: 0 12px 30px rgba(15,23,42,.13); overflow: hidden; }
    .tf-fc-mini-node { position: absolute; border-radius: 2px; opacity: .84; }
    .tf-fc-zoom-readout { min-width: 48px; text-align: center; color: #475569; font-size: 12px; font-weight: 800; }
    .tf-fc-file { display: none; }
    .tf-fc-divider { width: 1px; height: 24px; background: #e2e8f0; margin: 0 2px; }
    .tf-fc-modal-backdrop { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 34px; background: rgba(0,0,0,.58); }
    .tf-fc-modal { width: min(1120px, calc(100vw - 68px)); height: min(760px, calc(100vh - 68px)); border: 1px solid rgba(255,255,255,.15); border-radius: 12px; background: #181a20; color: #f8fafc; box-shadow: 0 30px 80px rgba(0,0,0,.6); display: grid; grid-template-rows: 48px minmax(0, 1fr) 58px; overflow: hidden; }
    .tf-fc-modal-head, .tf-fc-modal-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 14px; border-bottom: 1px solid rgba(255,255,255,.1); }
    .tf-fc-modal-foot { border-top: 1px solid rgba(255,255,255,.1); border-bottom: 0; justify-content: flex-end; }
    .tf-fc-modal-title { font-size: 14px; font-weight: 900; }
    .tf-fc-modal-body { display: grid; grid-template-columns: 1fr 282px; min-height: 0; }
    .tf-fc-vr-immersive { position: fixed; inset: 0; z-index: 2147483100; background: #020617; overflow: hidden; }
    .tf-fc-vr-immersive-host { position: absolute; inset: 0; }
    .tf-fc-vr-immersive-actions { position: absolute; top: 18px; right: 18px; z-index: 6; display: flex; align-items: center; gap: 8px; }
    .tf-fc-vr-immersive-actions .tf-fc-btn { border-color: rgba(255,255,255,.18); background: rgba(2,6,23,.62); color: rgba(255,255,255,.92); box-shadow: 0 16px 38px rgba(0,0,0,.3); backdrop-filter: blur(14px); }
    .tf-fc-vr-immersive-actions .tf-fc-btn:hover { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.32); }
    .tf-fc-vr-immersive-actions .tf-fc-btn.close { width: 36px; padding: 0; font-size: 19px; line-height: 1; }
    .tf-fc-tool-canvas { min-height: 0; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 24px; background: #101116; position: relative; }
    .tf-fc-tool-canvas img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .tf-fc-tool-side { border-left: 1px solid rgba(255,255,255,.1); padding: 14px; display: grid; align-content: start; gap: 12px; background: rgba(255,255,255,.025); overflow: auto; }
    .tf-fc-crop-box { position: absolute; border: 2px solid #f8fafc; box-shadow: 0 0 0 9999px rgba(0,0,0,.42); pointer-events: none; }
    .tf-fc-annotate-layer { position: absolute; inset: 24px; pointer-events: none; }
    .tf-fc-annotation { position: absolute; transform: translate(-50%,-50%); padding: 5px 8px; border-radius: 999px; background: rgba(15,23,42,.82); color: #fff; font-size: 13px; font-weight: 850; white-space: nowrap; }
    .tf-fc-storyboard-grid { display: grid; gap: 8px; width: min(100%, 860px); }
    .tf-fc-story-card { min-width: 0; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; overflow: hidden; background: #111318; }
    .tf-fc-story-card img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
    .tf-fc-story-card textarea { width: 100%; min-height: 58px; resize: vertical; border: 0; border-top: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.04); color: #f8fafc; padding: 7px; font-size: 12px; outline: none; }
    .tf-fc-stage { background-color: #f8fafc; background-image: radial-gradient(#d7dee8 1px, transparent 1px); }
    .tf-fc-edge { stroke: #64748b; }
    .tf-fc-node { background: #fff; border-color: #d7dee8; color: #111827; box-shadow: 0 12px 30px rgba(15,23,42,.12); }
    .tf-fc-node.selected { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,.16), 0 18px 38px rgba(15,23,42,.18); }
    .tf-fc-node-head { background: #fff; border-bottom-color: #eef2f7; }
    .tf-fc-node-title { color: #111827; }
    .tf-fc-thumb { background-color: #f8fafc; border-color: #e2e8f0; color: #64748b; }
    .tf-fc-dropzone { background: #f8fafc; border-color: #cbd5e1; color: #64748b; }
    .tf-fc-dropzone strong { color: #111827; }
    .tf-fc-prompt-inline { background: #fff; border-color: #d1d5db; color: #111827; }
    .tf-fc-chip-dark { background: #f8fafc; border-color: #e2e8f0; color: #475569; }
    .tf-fc-node-tools { background: rgba(255,255,255,.96); border-color: rgba(148,163,184,.45); box-shadow: 0 12px 30px rgba(15,23,42,.16); }
    .tf-fc-tool-btn { color: #111827; }
    .tf-fc-tool-btn:hover { background: #f1f5f9; }
    .tf-fc-tool-btn.danger { color: #b91c1c; }
    .tf-fc-tool-sep { background: #e2e8f0; }
    .tf-fc-director-3d { position: relative; height: 190px; min-height: 190px; border-radius: 8px; border: 1px solid #dbe3ef; overflow: hidden; background: linear-gradient(180deg,#f7fbff 0%,#eef4fa 58%,#dbe5ef 59%,#cfdce9 100%); perspective: 720px; }
    .tf-fc-director-3d.real { background: #f8fafc; perspective: none; }
    .tf-fc-director-inline-host { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 190px; background: #fff; }
    .tf-fc-director-3d.has-bg { background-size: cover; background-position: center; }
    .tf-fc-director-grid { position: absolute; left: 18px; right: 18px; bottom: 20px; height: 58px; transform: rotateX(62deg); transform-origin: 50% 100%; background-image: linear-gradient(#b6c3d1 1px,transparent 1px),linear-gradient(90deg,#b6c3d1 1px,transparent 1px); background-size: 24px 24px; opacity: .7; }
    .tf-fc-director-camera { position: absolute; right: 22px; bottom: 42px; width: 42px; height: 28px; border-radius: 7px; border: 2px solid #2563eb; background: rgba(37,99,235,.12); transform-style: preserve-3d; }
    .tf-fc-director-camera:before { content: ""; position: absolute; left: -16px; top: 8px; width: 18px; height: 10px; border-radius: 4px 0 0 4px; background: #2563eb; }
    .tf-fc-director-camera:after { content: ""; position: absolute; left: 8px; top: -26px; width: 150px; height: 86px; border: 1px dashed rgba(37,99,235,.55); transform: translateZ(-28px) rotateY(-18deg); transform-origin: 0 50%; }
    .tf-fc-human3d { position: absolute; left: 50%; top: 58%; width: 72px; height: 128px; transform-style: preserve-3d; transform-origin: 50% 72%; }
    .tf-fc-human3d .part { position: absolute; left: 50%; transform-style: preserve-3d; transform: translateX(-50%); background: linear-gradient(135deg,#f9fafb,#94a3b8); border: 1px solid rgba(15,23,42,.28); box-shadow: inset -8px -8px 14px rgba(15,23,42,.16), 0 8px 18px rgba(15,23,42,.14); }
    .tf-fc-human3d .head { top: 0; width: 28px; height: 28px; border-radius: 50%; }
    .tf-fc-human3d .torso { top: 32px; width: 38px; height: 52px; border-radius: 18px 18px 12px 12px; background: linear-gradient(135deg,#dbeafe,#64748b); }
    .tf-fc-human3d .arm-l,.tf-fc-human3d .arm-r { top: 38px; width: 13px; height: 48px; border-radius: 999px; transform-origin: 50% 8%; }
    .tf-fc-human3d .arm-l { margin-left: -32px; transform: translateX(-50%) rotateZ(18deg); }
    .tf-fc-human3d .arm-r { margin-left: 32px; transform: translateX(-50%) rotateZ(-18deg); }
    .tf-fc-human3d .leg-l,.tf-fc-human3d .leg-r { top: 82px; width: 15px; height: 48px; border-radius: 999px; transform-origin: 50% 5%; background: linear-gradient(135deg,#e5e7eb,#64748b); }
    .tf-fc-human3d .leg-l { margin-left: -12px; transform: translateX(-50%) rotateZ(7deg); }
    .tf-fc-human3d .leg-r { margin-left: 12px; transform: translateX(-50%) rotateZ(-7deg); }
    .tf-fc-human3d .shadow { position: absolute; left: 50%; top: 126px; width: 62px; height: 16px; border-radius: 50%; transform: translateX(-50%) rotateX(78deg); background: rgba(15,23,42,.18); filter: blur(2px); }
    .tf-fc-human3d.soldier { width: 42px; height: 82px; }
    .tf-fc-human3d.soldier .head { width: 18px; height: 18px; }
    .tf-fc-human3d.soldier .torso { top: 22px; width: 25px; height: 34px; }
    .tf-fc-human3d.soldier .arm-l,.tf-fc-human3d.soldier .arm-r { top: 26px; width: 8px; height: 31px; }
    .tf-fc-human3d.soldier .leg-l,.tf-fc-human3d.soldier .leg-r { top: 54px; width: 9px; height: 28px; }
    .tf-fc-human3d.soldier .shadow { top: 82px; width: 38px; height: 10px; }
    .tf-fc-human3d .depth { position: absolute; left: 50%; top: 31px; width: 45px; height: 56px; border-radius: 18px 18px 12px 12px; transform: translateX(-50%) translateZ(-18px); background: linear-gradient(135deg,#94a3b8,#475569); opacity: .72; }
    .tf-fc-human3d.soldier .depth { top: 21px; width: 30px; height: 38px; }
    .tf-fc-human3d .side-l,.tf-fc-human3d .side-r { position: absolute; top: 36px; width: 13px; height: 48px; border-radius: 999px; background: linear-gradient(135deg,#cbd5e1,#475569); opacity: .85; }
    .tf-fc-human3d .side-l { left: 12px; transform: translateZ(-10px) rotateY(72deg); }
    .tf-fc-human3d .side-r { right: 12px; transform: translateZ(-10px) rotateY(-72deg); }
    .tf-fc-human3d.soldier .side-l,.tf-fc-human3d.soldier .side-r { top: 25px; width: 8px; height: 31px; }
    .tf-fc-human-label { position: absolute; left: 50%; top: -16px; transform: translateX(-50%); padding: 1px 5px; border-radius: 999px; background: rgba(15,23,42,.72); color: #fff; font-size: 10px; font-weight: 900; white-space: nowrap; }
    .tf-fc-camera-target { position: absolute; width: 16px; height: 16px; border: 2px solid #2563eb; border-radius: 50%; background: rgba(37,99,235,.12); transform: translate(-50%,-50%); box-shadow: 0 0 0 5px rgba(37,99,235,.08); }
    .tf-fc-camera-line { position: absolute; height: 2px; background: rgba(37,99,235,.55); transform-origin: 0 50%; pointer-events: none; }
    .tf-fc-pano-720-mark { position: absolute; right: 8px; bottom: 8px; height: 22px; display: inline-flex; align-items: center; padding: 0 7px; border-radius: 999px; background: rgba(234,88,12,.86); color: #fff; font-size: 11px; font-weight: 900; }
    .tf-fc-director-open { position: absolute; right: 8px; top: 8px; z-index: 3; height: 26px; border: 1px solid rgba(37,99,235,.35); border-radius: 7px; background: rgba(255,255,255,.92); color: #1d4ed8; padding: 0 9px; font-size: 12px; font-weight: 850; cursor: pointer; }
    .tf-fc-director-open:hover { background: #eff6ff; border-color: #2563eb; }
    .tf-fc-director-modal { width: min(1440px, calc(100vw - 44px)); height: min(900px, calc(100vh - 44px)); background: #f8fafc; color: #111827; border-color: rgba(148,163,184,.6); }
    .tf-fc-director-modal .tf-fc-modal-body { display: block; width: 100%; height: 100%; min-height: 0; overflow: hidden; background: #fff; }
    .tf-fc-director-host { position: relative; width: 100%; height: 100%; min-height: 540px; background: #fff; overflow: hidden; }
    .tf-d3-root, .tf-d3-root * { box-sizing: border-box; letter-spacing: 0; }
    .tf-d3-root { position: relative; width: 100%; height: 100%; min-height: 0; background: #fff; overflow: hidden; }
    .tf-d3-layout { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 0; display: grid; grid-template-columns: 260px minmax(0,1fr) 276px; background: #f8fafc; color: #111827; }
    .tf-d3-layout.compact { display: block; min-height: 190px; }
    .tf-d3-layout.compact .tf-d3-viewport { width: 100%; height: 100%; min-height: 190px; }
    .tf-d3-sidebar, .tf-d3-rightbar { min-height: 0; overflow: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; background: #fff; border-color: #e2e8f0; }
    .tf-d3-sidebar { border-right: 1px solid #e2e8f0; }
    .tf-d3-rightbar { border-left: 1px solid #e2e8f0; }
    .tf-d3-sidebar h3, .tf-d3-rightbar h3 { margin: 4px 0 0; font-size: 14px; font-weight: 900; color: #111827; }
    .tf-d3-viewport { position: relative; min-width: 0; min-height: 0; width: 100%; height: 100%; overflow: hidden; background: #fff !important; background-color: #fff !important; contain: layout paint size; }
    .tf-d3-white-backdrop { position: absolute; inset: 0; z-index: 0; background: #fff; }
    .tf-d3-viewport canvas { position: absolute; inset: 0; z-index: 1; width: 100% !important; height: 100% !important; display: block; cursor: grab; background: #fff !important; }
    .tf-d3-fallback { position: absolute; inset: 0; z-index: 2; display: none; overflow: hidden; background: #fff; color: #111827; }
    .tf-d3-fallback.active { display: block; }
    .tf-d3-fallback-grid { position: absolute; left: 8%; right: 8%; bottom: 9%; height: 46%; transform: perspective(720px) rotateX(58deg); transform-origin: 50% 100%; background-image: linear-gradient(#dbe4ef 1px, transparent 1px), linear-gradient(90deg, #dbe4ef 1px, transparent 1px); background-size: 34px 34px; border: 1px solid #e2e8f0; }
    .tf-d3-fallback-person { position: absolute; width: 44px; height: 96px; transform: translate(-50%,-78%); }
    .tf-d3-fallback-person .head { position: absolute; left: 13px; top: 0; width: 18px; height: 18px; border-radius: 50%; background: var(--c); box-shadow: inset -4px -4px 8px rgba(15,23,42,.22); }
    .tf-d3-fallback-person .body { position: absolute; left: 8px; top: 22px; width: 28px; height: 42px; border-radius: 13px 13px 8px 8px; background: var(--c); box-shadow: inset -7px -5px 12px rgba(15,23,42,.24); }
    .tf-d3-fallback-person .arm-l, .tf-d3-fallback-person .arm-r, .tf-d3-fallback-person .leg-l, .tf-d3-fallback-person .leg-r { position: absolute; border-radius: 999px; background: var(--c); box-shadow: inset -4px -4px 8px rgba(15,23,42,.2); }
    .tf-d3-fallback-person .arm-l { left: 0; top: 28px; width: 9px; height: 38px; transform: rotate(14deg); }
    .tf-d3-fallback-person .arm-r { right: 0; top: 28px; width: 9px; height: 38px; transform: rotate(-14deg); }
    .tf-d3-fallback-person .leg-l { left: 11px; top: 62px; width: 10px; height: 34px; }
    .tf-d3-fallback-person .leg-r { right: 11px; top: 62px; width: 10px; height: 34px; }
    .tf-d3-fallback-note { position: absolute; left: 10px; bottom: 10px; padding: 5px 8px; border: 1px solid #bfdbfe; border-radius: 7px; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 800; }
    .tf-d3-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .tf-d3-btn { min-height: 31px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #111827; padding: 0 9px; font-size: 12px; font-weight: 800; cursor: pointer; }
    .tf-d3-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
    .tf-d3-btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    .tf-d3-btn.mini { min-height: 31px; padding: 0 7px; font-size: 12px; white-space: nowrap; }
    .tf-d3-field { display: grid; gap: 5px; font-size: 12px; font-weight: 800; color: #334155; }
    .tf-d3-field-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; }
    .tf-d3-field input { width: 100%; height: 31px; border: 1px solid #cbd5e1; border-radius: 7px; padding: 0 8px; font-size: 13px; color: #111827; background: #fff; }
    .tf-d3-field.range input { padding: 0; accent-color: #2563eb; }
    .tf-d3-upload { min-height: 76px; border: 1px dashed #94a3b8; border-radius: 8px; display: grid; place-items: center; text-align: center; padding: 12px; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 900; cursor: pointer; }
    .tf-d3-upload input { display: none; }
    .tf-d3-swatches { display: grid; grid-template-columns: repeat(5,1fr); gap: 7px; }
    .tf-d3-swatches button { height: 25px; border: 2px solid transparent; border-radius: 6px; cursor: pointer; }
    .tf-d3-swatches button.active { border-color: #111827; box-shadow: 0 0 0 2px #dbeafe; }
    .tf-d3-presets { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
    @media (max-width: 980px) {
      .tf-fc-topbar { grid-template-columns: 1fr; align-items: start; }
      .tf-fc-toolbar { justify-self: start; max-width: calc(100vw - 28px); overflow-x: auto; }
      .tf-fc-statusbar { justify-self: start; }
      .tf-fc-inspector { width: 320px; top: 126px; }
      .tf-d3-layout { grid-template-columns: 210px minmax(0,1fr); }
      .tf-d3-rightbar { position: absolute; right: 0; top: 0; bottom: 0; width: 230px; box-shadow: -12px 0 28px rgba(15,23,42,.12); }
    }
  `;
  document.head.appendChild(style);

  const icon = (name) => {
    const paths = {
      back: "M15 18l-6-6 6-6M9 12h12",
      plus: "M12 5v14M5 12h14",
      save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
      undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2",
      redo: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h2",
      zoomIn: "M11 5v12M5 11h12M21 21l-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z",
      zoomOut: "M5 11h12M21 21l-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z",
      fit: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
      trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
      upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
      spark: "M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8L12 3z",
      video: "M4 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4zM18 10l4-3v10l-4-3",
      camera: "M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      actor: "M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 22a7 7 0 0 1 14 0M12 10v6M8 13h8",
      pano: "M3 12c3-4 15-4 18 0M3 12c3 4 15 4 18 0M12 3c4 3 4 15 0 18M12 3c-4 3-4 15 0 18",
      frame: "M4 5h16v14H4zM4 10h16M9 5v14",
      split: "M4 5h7v7H4zM13 12h7v7h-7zM13 5h7M4 19h7",
      group: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
      text: "M4 6h16M12 6v12M8 18h8",
      edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
    };
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
  };

  function html(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function attr(value) {
    return html(value).replace(/`/g, "&#96;");
  }

  function id(prefix = "node") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getToken() {
    const keys = ["token", "Authorization", "access_token", "toonflow-token"];
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of keys) {
        const value = storage.getItem(key);
        if (value) return value.replace(/^Bearer\s+/i, "");
      }
    }
    return "";
  }

  function rememberIds(input) {
    const text = typeof input === "string" ? input : JSON.stringify(input || {});
    const project = text.match(/"projectId"\s*:\s*"?(\d+)/) || text.match(/projectId[=/:"\s]+(\d+)/);
    const script = text.match(/"episodesId"\s*:\s*"?(\d+)/) || text.match(/"scriptId"\s*:\s*"?(\d+)/) || text.match(/episodesId[=/:"\s]+(\d+)/);
    if (project) state.projectId = Number(project[1]);
    if (script) state.scriptId = Number(script[1]);
  }

  function detectIds() {
    try {
      rememberIds(location.href);
      for (const storage of [localStorage, sessionStorage]) {
        for (const key of Object.keys(storage)) {
          const value = storage.getItem(key);
          if (value && /projectId|episodesId|scriptId/.test(value)) rememberIds(value);
        }
      }
    } catch {}
    return { projectId: state.projectId, scriptId: state.scriptId };
  }

  const originalFetch = window.fetch;
  window.fetch = function patchedFetch(input, init) {
    try {
      rememberIds(typeof input === "string" ? input : input?.url || "");
      if (typeof init?.body === "string") rememberIds(init.body);
    } catch {}
    return originalFetch.apply(this, arguments);
  };

  const originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function patchedSend(body) {
    try {
      if (typeof body === "string") rememberIds(body);
    } catch {}
    return originalXhrSend.apply(this, arguments);
  };

  async function api(path, body) {
    state.token = state.token || getToken();
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await originalFetch(path, { method: "POST", headers, body: JSON.stringify(body || {}) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.code === 400 || json.success === false) throw new Error(json.message || json.error || `请求失败 ${response.status}`);
    return json.data ?? json;
  }

  function setStatus(text) {
    state.status = text;
    const el = root.querySelector(".tf-fc-status");
    if (el) el.textContent = text;
  }

  function normalizeCanvas(data) {
    const canvas = data && Array.isArray(data.nodes) ? data : DEFAULT_CANVAS();
    return {
      nodes: canvas.nodes.map((node) => ({
        ...node,
        type: NODE_TYPES[node.type] ? node.type : "image",
        x: Number(node.x ?? node.position?.x) || 0,
        y: Number(node.y ?? node.position?.y) || 0,
        data: node.data || {},
      })),
      edges: Array.isArray(canvas.edges)
        ? canvas.edges.map((edge) => ({ id: edge.id || id("edge"), from: edge.from || edge.source, to: edge.to || edge.target })).filter((edge) => edge.from && edge.to)
        : [],
      viewport: {
        x: Number(canvas.viewport?.x ?? 48),
        y: Number(canvas.viewport?.y ?? 72),
        zoom: clamp(Number(canvas.viewport?.zoom ?? 1), ZOOM_MIN, ZOOM_MAX),
      },
      meta: { version: VERSION, ...(canvas.meta || {}) },
      updatedAt: canvas.updatedAt || 0,
    };
  }

  function requireIds() {
    const projectInput = root.querySelector('[data-fc="projectId"]');
    const scriptInput = root.querySelector('[data-fc="scriptId"]');
    state.projectId = Number(projectInput?.value) || state.projectId;
    state.scriptId = Number(scriptInput?.value) || state.scriptId;
    if (!state.projectId || !state.scriptId) throw new Error("缺少项目ID或剧集ID，请先在顶部填写");
  }

  function nodeById(nodeId) {
    return state.canvas.nodes.find((node) => node.id === nodeId);
  }

  function selectedNode() {
    return nodeById(state.selectedId);
  }

  function incoming(nodeId) {
    return state.canvas.edges.filter((edge) => edge.to === nodeId).map((edge) => nodeById(edge.from)).filter(Boolean);
  }

  function outgoing(nodeId) {
    return state.canvas.edges.filter((edge) => edge.from === nodeId).map((edge) => nodeById(edge.to)).filter(Boolean);
  }

  function mediaFromNode(node) {
    const d = node?.data || {};
    return d.videoUrl || d.outputUrl || d.imageUrl || d.panoramaUrl || d.src || "";
  }

  function imageRefs(nodeId) {
    const refs = [];
    for (const node of incoming(nodeId)) {
      const d = node.data || {};
      [d.outputUrl, d.imageUrl, d.panoramaUrl, d.src].forEach((url) => url && refs.push(url));
      (d.screenshots || []).forEach((shot) => shot?.url && refs.push(shot.url));
    }
    const own = nodeById(nodeId)?.data || {};
    if (own.outputUrl || own.imageUrl || own.src) refs.unshift(own.outputUrl || own.imageUrl || own.src);
    return [...new Set(refs)];
  }

  function pushHistory() {
    state.history.push(clone(state.canvas));
    if (state.history.length > 60) state.history.shift();
    state.future = [];
  }

  function undo() {
    if (!state.history.length) return;
    state.future.push(clone(state.canvas));
    state.canvas = normalizeCanvas(state.history.pop());
    state.selectedId = null;
    render();
    scheduleSave();
  }

  function redo() {
    if (!state.future.length) return;
    state.history.push(clone(state.canvas));
    state.canvas = normalizeCanvas(state.future.pop());
    state.selectedId = null;
    render();
    scheduleSave();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function screenToWorld(clientX, clientY) {
    const stage = root.querySelector(".tf-fc-stage");
    const rect = stage?.getBoundingClientRect() || { left: 0, top: 0 };
    const vp = state.canvas.viewport;
    return { x: (clientX - rect.left - vp.x) / vp.zoom, y: (clientY - rect.top - vp.y) / vp.zoom };
  }

  function makeNode(type, x, y, data = {}) {
    const cfg = NODE_TYPES[type] || NODE_TYPES.image;
    const count = state.canvas.nodes.length;
    const position = typeof x === "number" && typeof y === "number" ? { x, y } : screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    return {
      id: id(),
      type,
      x: Math.round(position.x + (count % 3) * 18),
      y: Math.round(position.y + (count % 3) * 18),
      data: {
        title: cfg.title,
        prompt: "",
        story: "",
        videoDesc: "",
        note: "",
        duration: 5,
        targetCount: 8,
        mode: type === "panorama" ? "360" : "",
        yaw: 50,
        pitch: 50,
        resolution: "720p",
        outputTarget: "all",
        screenshots: [],
        ...data,
      },
    };
  }

  function addNode(type, x, y, data, connectFrom) {
    pushHistory();
    const node = makeNode(type, x, y, data);
    state.canvas.nodes.push(node);
    if (connectFrom) connect(connectFrom, node.id, false);
    state.selectedId = node.id;
    state.menu = null;
    render();
    scheduleSave();
    return node;
  }

  function updateNode(nodeId, patch, shouldRender = true) {
    const node = nodeById(nodeId);
    if (!node) return;
    node.data = { ...(node.data || {}), ...patch };
    if (shouldRender) render();
    scheduleSave();
  }

  function connect(from, to, withHistory = true) {
    if (!from || !to || from === to) return;
    if (withHistory) pushHistory();
    if (!state.canvas.edges.some((edge) => edge.from === from && edge.to === to)) {
      state.canvas.edges.push({ id: id("edge"), from, to });
    }
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    pushHistory();
    const selected = state.selectedId;
    state.canvas.nodes = state.canvas.nodes.filter((node) => node.id !== selected);
    state.canvas.edges = state.canvas.edges.filter((edge) => edge.from !== selected && edge.to !== selected);
    state.selectedId = null;
    render();
    scheduleSave();
  }

  function loadModelValue(value) {
    return String(value || "").trim() || undefined;
  }

  async function loadModels() {
    if (state.modelLoaded) return;
    try {
      const [image, video] = await Promise.all([
        api("/api/modelSelect/getModelList", { type: "image" }).catch(() => []),
        api("/api/modelSelect/getModelList", { type: "video" }).catch(() => []),
      ]);
      state.models.image = Array.isArray(image) ? image : [];
      state.models.video = Array.isArray(video) ? video : [];
    } finally {
      state.modelLoaded = true;
    }
  }

  async function loadCanvas() {
    requireIds();
    setStatus("读取自由画布...");
    const data = await api("/api/production/freeCanvas/getCanvas", { projectId: state.projectId, scriptId: state.scriptId });
    state.canvas = normalizeCanvas(data);
    state.selectedId = state.canvas.nodes[0]?.id || null;
    state.history = [];
    state.future = [];
    render();
    setStatus("自由画布已读取");
  }

  async function saveCanvas(manual) {
    requireIds();
    if (state.saving) return;
    state.saving = true;
    setStatus(manual ? "手动保存中..." : "自动保存中...");
    try {
      state.canvas = normalizeCanvas(await api("/api/production/freeCanvas/saveCanvas", {
        projectId: state.projectId,
        scriptId: state.scriptId,
        canvas: state.canvas,
      }));
      setStatus(`${manual ? "已手动保存" : "已自动保存"} ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      setStatus(`保存失败：${err.message}`);
    } finally {
      state.saving = false;
    }
  }

  function scheduleSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      if (state.open && state.projectId && state.scriptId) saveCanvas(false);
    }, 1100);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadFileLegacy(file, node) {
    requireIds();
    setStatus("上传中...");
    const uploaded = await api("/api/production/freeCanvas/uploadFile", {
      projectId: state.projectId,
      scriptId: state.scriptId,
      base64Data: await fileToBase64(file),
    });
    const media = uploaded.url;
    if (node.type === "panorama") updateNode(node.id, { panoramaUrl: media, imageUrl: media, sourceFileName: file.name });
    else if (uploaded.kind === "video") updateNode(node.id, { videoUrl: media, sourceFileName: file.name });
    else updateNode(node.id, { imageUrl: media, outputUrl: media, src: media, sourceFileName: file.name });
    setStatus("上传完成");
  }

  async function uploadFile(file, node) {
    const base64Data = await fileToBase64(file);
    const localPatch = file.type.startsWith("video/")
      ? { videoUrl: base64Data, sourceFileName: file.name, localPreview: true }
      : node.type === "panorama" || node.type === "director"
        ? { panoramaUrl: base64Data, imageUrl: base64Data, directorPanoramaEnabled: false, directorPanoramaEnabledV2: true, sourceFileName: file.name, localPreview: true }
        : { imageUrl: base64Data, outputUrl: base64Data, src: base64Data, sourceFileName: file.name, localPreview: true };
    updateNode(node.id, localPatch);
    setStatus("已载入本地预览，正在保存到素材库...");

    try {
      requireIds();
      const uploaded = await api("/api/production/freeCanvas/uploadFile", {
        projectId: state.projectId,
        scriptId: state.scriptId,
        base64Data,
      });
      const media = uploaded.url;
      if (node.type === "panorama" || node.type === "director") updateNode(node.id, { panoramaUrl: media, imageUrl: media, directorPanoramaEnabled: false, directorPanoramaEnabledV2: true, sourceFileName: file.name, localPreview: false });
      else if (uploaded.kind === "video") updateNode(node.id, { videoUrl: media, sourceFileName: file.name, localPreview: false });
      else updateNode(node.id, { imageUrl: media, outputUrl: media, src: media, sourceFileName: file.name, localPreview: false });
      setStatus("上传完成");
    } catch (err) {
      setStatus(`已本地预览，上传未完成：${err.message}`);
    }
  }

  async function splitScript(node) {
    requireIds();
    const script = (node.data.prompt || node.data.story || "").trim();
    if (!script) throw new Error("请先在剧情拆分节点里输入剧情");
    setStatus("正在拆分 6-9 个镜头...");
    const result = await api("/api/production/freeCanvas/splitScript", {
      projectId: state.projectId,
      scriptId: state.scriptId,
      script,
      targetCount: Number(node.data.targetCount) || 8,
    });
    const shots = result.shots || [];
    pushHistory();
    const baseX = node.x + 340;
    const baseY = node.y;
    shots.forEach((shot, index) => {
      const frame = makeNode("storyboardFrame", baseX + (index % 3) * 318, baseY + Math.floor(index / 3) * 250, {
        title: shot.title || `镜头 ${index + 1}`,
        index: shot.index || index + 1,
        story: shot.story || "",
        prompt: shot.prompt || shot.story || "",
        videoDesc: shot.videoDesc || shot.prompt || "",
        duration: Number(shot.duration) || 5,
        shotType: shot.shotType || "",
        cameraAngle: shot.cameraAngle || "",
        cameraMovement: shot.cameraMovement || "",
        composition: shot.composition || "",
        actorBlocking: shot.actorBlocking || "",
        emotionBeat: shot.emotionBeat || "",
        directorNote: shot.directorNote || "",
      });
      state.canvas.nodes.push(frame);
      connect(node.id, frame.id, false);
      const video = makeNode("image2video", frame.x, frame.y + 182, {
        title: `视频生成 ${index + 1}`,
        prompt: shot.videoDesc || shot.prompt || "",
        duration: Number(shot.duration) || 5,
      });
      state.canvas.nodes.push(video);
      connect(frame.id, video.id, false);
    });
    state.selectedId = node.id;
    render();
    scheduleSave();
    setStatus(`已生成 ${shots.length} 个分镜帧和对应视频节点`);
  }

  async function importCurrentStoryboard() {
    requireIds();
    setStatus("导入当前分镜表...");
    const data = await api("/api/production/getFlowData", { projectId: state.projectId, episodesId: state.scriptId });
    const frames = Array.isArray(data.storyboard) ? data.storyboard : [];
    if (!frames.length) throw new Error("当前剧集没有可导入的分镜");
    pushHistory();
    const group = makeNode("group", 80, 80, { title: "导入的分镜表", note: `共 ${frames.length} 镜` });
    state.canvas.nodes.push(group);
    frames.forEach((item, index) => {
      const frame = makeNode("storyboardFrame", 400 + (index % 3) * 318, 90 + Math.floor(index / 3) * 250, {
        title: `镜头 ${item.index || index + 1}`,
        index: item.index || index + 1,
        prompt: item.prompt || "",
        videoDesc: item.videoDesc || "",
        duration: Number(item.duration) || 5,
        imageUrl: item.src || null,
        outputUrl: item.src || null,
        src: item.src || null,
        state: item.state || "",
        shotType: item.shotType || "",
        cameraAngle: item.cameraAngle || "",
        cameraMovement: item.cameraMovement || "",
        composition: item.composition || "",
        actorBlocking: item.actorBlocking || "",
        emotionBeat: item.emotionBeat || "",
        directorNote: item.directorNote || "",
        sourceStoryboardId: item.id,
      });
      state.canvas.nodes.push(frame);
      connect(group.id, frame.id, false);
    });
    render();
    scheduleSave();
    setStatus(`已导入 ${frames.length} 个分镜`);
  }

  async function generateImage(node) {
    requireIds();
    const prompt = node.data.prompt || node.data.title || "";
    if (!prompt.trim()) throw new Error("请先填写图片提示词");
    const refs = node.type === "text2image" ? [] : imageRefs(node.id);
    setStatus("图片生成中...");
    const data = await api("/api/production/freeCanvas/generateImage", {
      projectId: state.projectId,
      scriptId: state.scriptId,
      prompt,
      model: loadModelValue(node.data.model),
      references: refs,
      quality: node.data.quality || undefined,
      ratio: node.data.ratio || undefined,
    });
    updateNode(node.id, { outputUrl: data.url, imageUrl: data.url, src: data.url, references: refs, state: "生成成功", errorReason: "" });
    setStatus("图片生成完成");
  }

  async function generateVideo(node) {
    requireIds();
    const prompt = node.data.prompt || node.data.videoDesc || node.data.title || "";
    if (!prompt.trim()) throw new Error("请先填写视频描述");
    const refs = imageRefs(node.id);
    setStatus("视频任务已提交...");
    const data = await api("/api/production/freeCanvas/generateVideo", {
      projectId: state.projectId,
      scriptId: state.scriptId,
      prompt,
      model: loadModelValue(node.data.model),
      references: refs,
      mode: node.data.mode || (refs.length ? "singleImage" : "text"),
      resolution: node.data.resolution || "720p",
      duration: Number(node.data.duration) || 5,
      audio: !!node.data.audio,
      trackId: Number(node.data.trackId) || undefined,
    });
    updateNode(node.id, { videoId: data.videoId, trackId: data.trackId, videoState: "生成中", errorReason: "", references: refs });
    pollVideo(node.id, data.videoId);
  }

  async function pollVideo(nodeId, videoId) {
    if (state.videoPollTimers.has(videoId)) return;
    const timer = setInterval(async () => {
      try {
        const video = await api("/api/production/freeCanvas/getVideo", { videoId });
        const stateText = video.state || "";
        updateNode(nodeId, { videoState: stateText, videoUrl: video.src || "", errorReason: video.errorReason || "" });
        if (stateText.includes("成功") || stateText.includes("完成") || stateText.includes("失败")) {
          clearInterval(timer);
          state.videoPollTimers.delete(videoId);
          setStatus(stateText.includes("失败") ? `视频失败：${video.errorReason || ""}` : "视频生成完成");
        }
      } catch {}
    }, 4000);
    state.videoPollTimers.set(videoId, timer);
  }

  async function syncStoryboard() {
    requireIds();
    const frames = state.canvas.nodes
      .filter((node) => node.type === "storyboardFrame")
      .sort((a, b) => Number(a.data.index || 0) - Number(b.data.index || 0))
      .map((node, index) => ({
        id: node.id,
        prompt: node.data.prompt || node.data.story || `镜头 ${index + 1}`,
        videoDesc: node.data.videoDesc || node.data.prompt || "",
        duration: Number(node.data.duration) || 5,
        track: node.data.track || `自由画布-${index + 1}`,
        state: node.data.imageUrl || node.data.outputUrl || node.data.src ? "生成成功" : "未生成",
        src: node.data.outputUrl || node.data.imageUrl || node.data.src || null,
        shotType: node.data.shotType || null,
        cameraAngle: node.data.cameraAngle || null,
        cameraMovement: node.data.cameraMovement || null,
        composition: node.data.composition || null,
        actorBlocking: node.data.actorBlocking || null,
        emotionBeat: node.data.emotionBeat || null,
        directorNote: node.data.directorNote || null,
      }));
    if (!frames.length) throw new Error("没有分镜帧节点可同步");
    setStatus("同步到分镜表...");
    const result = await api("/api/production/freeCanvas/syncStoryboard", { projectId: state.projectId, scriptId: state.scriptId, frames });
    setStatus(`已同步 ${result.inserted?.length || frames.length} 条分镜`);
  }

  function exportCanvasJson() {
    const blob = new Blob([JSON.stringify(state.canvas, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toonflow-free-canvas-${state.projectId || "project"}-${state.scriptId || "script"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("已导出本地 JSON");
  }

  function importCanvasJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        pushHistory();
        state.canvas = normalizeCanvas(JSON.parse(String(reader.result || "{}")));
        state.selectedId = state.canvas.nodes[0]?.id || null;
        render();
        scheduleSave();
        setStatus("已导入画布 JSON");
      } catch (err) {
        setStatus(`导入失败：${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function makePanoShot(node, grid) {
    const url = node.data.panoramaUrl || node.data.imageUrl;
    if (!url) throw new Error("请先上传全景图");
    const side = Math.sqrt(grid);
    if (!Number.isInteger(side)) throw new Error("截图网格不正确");
    const api = await ensurePanoramaViewerModule();
    const basePitch = Number(node.data.panoPitchDeg ?? api.legacyPitchToDeg?.(node.data || {}) ?? 0);
    const fov = Number(node.data.panoFov || 75);
    setStatus(`生成 ${grid} 宫格截图...`);
    pushHistory();
    const shots = [];
    for (let row = 0; row < side; row += 1) {
      for (let col = 0; col < side; col += 1) {
        const yaw = (360 / grid) * (row * side + col);
        const pitch = grid === 4 ? basePitch : basePitch + (row - (side - 1) / 2) * 18;
        const dataUrl = await api.capturePanoramaUrl(url, {
          width: 960,
          height: 540,
          yaw,
          pitch,
          fov,
        });
        const media = await uploadCanvasImage(dataUrl);
        shots.push({ url: media, label: `${grid}宫格 ${row + 1}-${col + 1}` });
        const imgNode = makeNode("image", node.x + 318 + col * 300, node.y + row * 196, {
          title: `${grid}宫格截图 ${row + 1}-${col + 1}`,
          imageUrl: media,
          outputUrl: media,
          src: media,
          localPreview: media === dataUrl,
        });
        state.canvas.nodes.push(imgNode);
        connect(node.id, imgNode.id, false);
      }
    }
    node.data.screenshots = [...(node.data.screenshots || []), ...shots];
    render();
    scheduleSave();
    setStatus(`${grid} 宫格截图完成`);
  }

  function isPano720(data) {
    return String(data?.mode || "360") === "720";
  }

  function resolvePanoCss(data) {
    const mode720 = isPano720(data);
    const zoom = Number(data.panoZoom || (mode720 ? 180 : 240));
    const pitch = mode720 ? Number(data.pitch || 50) : 50;
    const sizeY = mode720 ? Math.max(120, Math.round(zoom * 0.78)) : 135;
    return {
      size: `${zoom}% ${sizeY}%`,
      position: `${Number(data.yaw || 50)}% ${pitch}%`,
    };
  }

  function resolvePanoViewCrop(img, data) {
    const mode720 = isPano720(data);
    const zoom = clamp(Number(data.panoZoom || (mode720 ? 180 : 240)) / 100, 1, 4);
    const sw = img.width / zoom;
    const sh = mode720 ? img.height / Math.max(1, zoom * 0.72) : img.height / Math.max(1, zoom * 0.42);
    const sx = clamp((Number(data.yaw || 50) / 100) * img.width - sw / 2, 0, Math.max(0, img.width - sw));
    const sy = clamp(((mode720 ? Number(data.pitch || 50) : 50) / 100) * img.height - sh / 2, 0, Math.max(0, img.height - sh));
    return { sx, sy, sw: Math.max(1, Math.min(sw, img.width)), sh: Math.max(1, Math.min(sh, img.height)) };
  }

  function resolvePanoGridCrop(img, data, row, col, size) {
    if (isPano720(data)) {
      return {
        sx: (img.width / size) * col,
        sy: (img.height / size) * row,
        sw: img.width / size,
        sh: img.height / size,
      };
    }
    return {
      sx: (img.width / size) * col,
      sy: 0,
      sw: img.width / size,
      sh: img.height,
    };
  }

  async function uploadCanvasImage(dataUrl) {
    try {
      requireIds();
      const uploaded = await api("/api/production/freeCanvas/uploadFile", {
        projectId: state.projectId,
        scriptId: state.scriptId,
        base64Data: dataUrl,
      });
      return uploaded.url || dataUrl;
    } catch {
      return dataUrl;
    }
  }

  async function ensureDirectorStudioModule() {
    if (window.ToonflowDirector3DStudio) return window.ToonflowDirector3DStudio;
    await import("./director-3d-studio.js");
    if (!window.ToonflowDirector3DStudio) throw new Error("3D导演台模块加载失败");
    return window.ToonflowDirector3DStudio;
  }

  async function ensurePanoramaViewerModule() {
    if (window.ToonflowPanoramaViewer) return window.ToonflowPanoramaViewer;
    await import("./panorama-viewer.js");
    if (!window.ToonflowPanoramaViewer) throw new Error("VR全景浏览器模块加载失败");
    return window.ToonflowPanoramaViewer;
  }

  function destroyDirectorStudio() {
    if (state.directorStudio?.instance) {
      state.directorStudio.instance.destroy();
    }
    state.directorStudio = null;
  }

  function destroyInlineDirectorStudios() {
    for (const item of state.directorInlineStudios.values()) item.instance?.destroy();
    state.directorInlineStudios.clear();
  }

  function destroyPanoramaViewers() {
    for (const item of state.panoramaViewers.values()) item.instance?.destroy();
    state.panoramaViewers.clear();
  }

  function destroyImmersivePanoramaViewer() {
    const item = state.panoramaViewers.get("__immersive__");
    item?.instance?.destroy();
    state.panoramaViewers.delete("__immersive__");
  }

  async function mountPanoramaViewers(shell) {
    const hosts = [...shell.querySelectorAll("[data-pano-vr-host]")];
    const liveIds = new Set(hosts.map((host) => host.dataset.panoVrHost));
    for (const [nodeId, item] of state.panoramaViewers) {
      if (!liveIds.has(nodeId) || !document.contains(item.host)) {
        item.instance?.destroy();
        state.panoramaViewers.delete(nodeId);
      }
    }
    if (!hosts.length) return;
    const api = await ensurePanoramaViewerModule();
    for (const host of hosts) {
      const node = nodeById(host.dataset.panoVrHost);
      if (!node || state.panoramaViewers.get(node.id)?.host === host) continue;
      state.panoramaViewers.get(node.id)?.instance?.destroy();
      const instance = api.create(host, node.data || {}, {
        onChange: (patch, saveNow) => {
          const current = nodeById(node.id);
          if (!current) return;
          current.data = { ...(current.data || {}), ...patch };
          if (saveNow) scheduleSave();
        },
        onCapture: () => run(() => capturePanoView(node)),
        onGrid: (grid) => run(() => makePanoShot(node, grid)),
      }, { compact: true });
      state.panoramaViewers.set(node.id, { host, instance });
    }
  }

  async function mountImmersivePanoramaViewer(shell) {
    const host = shell.querySelector("[data-pano-immersive-host]");
    if (!host) {
      destroyImmersivePanoramaViewer();
      return;
    }
    const node = nodeById(host.dataset.panoImmersiveHost);
    if (!node) return;
    const live = state.panoramaViewers.get("__immersive__");
    if (live?.nodeId === node.id && live.host === host) return;
    destroyImmersivePanoramaViewer();
    const api = await ensurePanoramaViewerModule();
    const instance = api.create(host, node.data || {}, {
      onChange: (patch, saveNow) => {
        const current = nodeById(node.id);
        if (!current) return;
        current.data = { ...(current.data || {}), ...patch };
        const compact = state.panoramaViewers.get(node.id)?.instance;
        if (compact && typeof compact.load === "function") {
          Object.assign(compact.data, current.data);
        }
        if (saveNow) scheduleSave();
      },
    }, { compact: true, immersive: true });
    state.panoramaViewers.set("__immersive__", { nodeId: node.id, host, instance });
  }

  async function mountDirectorStudio(shell) {
    const host = shell.querySelector("[data-director-host]");
    if (!host) {
      destroyDirectorStudio();
      return;
    }
    const node = nodeById(host.dataset.directorHost);
    if (!node) return;
    if (state.directorStudio?.nodeId === node.id && state.directorStudio.host === host) return;
    destroyDirectorStudio();
    const api = await ensureDirectorStudioModule();
    state.directorStudio = {
      nodeId: node.id,
      host,
      dirty: false,
      instance: api.create(host, node.data || {}, {
        onChange: (patch, saveNow) => {
          const current = nodeById(node.id);
          if (!current) return;
          current.data = { ...(current.data || {}), ...patch };
          state.directorStudio.dirty = true;
          if (saveNow) scheduleSave();
        },
      }),
    };
  }

  async function mountInlineDirectorStudios(shell) {
    const hosts = [...shell.querySelectorAll("[data-director-inline-host]")];
    const liveIds = new Set(hosts.map((host) => host.dataset.directorInlineHost));
    for (const [nodeId, item] of state.directorInlineStudios) {
      if (!liveIds.has(nodeId) || !document.contains(item.host)) {
        item.instance?.destroy();
        state.directorInlineStudios.delete(nodeId);
      }
    }
    if (!hosts.length) return;
    const api = await ensureDirectorStudioModule();
    for (const host of hosts) {
      const node = nodeById(host.dataset.directorInlineHost);
      if (!node || state.directorInlineStudios.get(node.id)?.host === host) continue;
      state.directorInlineStudios.get(node.id)?.instance?.destroy();
      const instance = api.create(host, node.data || {}, {
        onChange: (patch, saveNow) => {
          const current = nodeById(node.id);
          if (!current) return;
          current.data = { ...(current.data || {}), ...patch };
          if (saveNow) scheduleSave();
        },
      }, { compact: true });
      state.directorInlineStudios.set(node.id, { host, instance });
    }
  }

  function openDirectorStudio(node) {
    if (!node) return;
    state.toolDialog = { type: "director3d", nodeId: node.id };
    render();
  }

  function openPanoImmersive(node) {
    if (!node) return;
    const url = node.data?.panoramaUrl || node.data?.imageUrl || node.data?.outputUrl || node.data?.src;
    if (!url) {
      setStatus("请先上传全景图");
      return;
    }
    state.toolDialog = { type: "panoImmersive", nodeId: node.id };
    render();
  }

  async function saveDirectorStudio() {
    const studio = state.directorStudio;
    if (!studio?.instance) return;
    const node = nodeById(studio.nodeId);
    if (!node) return;
    updateNode(node.id, studio.instance.getPatch(), true);
    setStatus("3D导演台已保存");
  }

  async function captureDirectorStudio() {
    const studio = state.directorStudio;
    if (!studio?.instance) return;
    const node = nodeById(studio.nodeId);
    if (!node) return;
    const dataUrl = studio.instance.captureDataUrl();
    const patch = studio.instance.getPatch(dataUrl);
    node.data = { ...(node.data || {}), ...patch };
    const media = await uploadCanvasImage(dataUrl);
    node.data = { ...(node.data || {}), directorShotUrl: media };
    addNode("image", node.x + 318, node.y, {
      title: `${node.data.title || NODE_TYPES[node.type].title} 3D截图`,
      imageUrl: media,
      outputUrl: media,
      src: media,
      localPreview: media === dataUrl,
    }, node.id);
    state.toolDialog = null;
    destroyDirectorStudio();
    render();
    setStatus("3D导演台截图已生成图片节点");
  }

  async function cropImageToDataUrl(source, crop) {
    const img = await loadImage(source);
    const canvas = document.createElement("canvas");
    const x = clamp(Number(crop.cropX ?? 15), 0, 99) / 100 * img.width;
    const y = clamp(Number(crop.cropY ?? 15), 0, 99) / 100 * img.height;
    const w = clamp(Number(crop.cropW ?? 70), 1, 100) / 100 * img.width;
    const h = clamp(Number(crop.cropH ?? 70), 1, 100) / 100 * img.height;
    canvas.width = Math.max(1, Math.round(Math.min(w, img.width - x)));
    canvas.height = Math.max(1, Math.round(Math.min(h, img.height - y)));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }

  async function annotateImageToDataUrl(source, annotations) {
    const img = await loadImage(source);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    ctx.font = `${Math.max(22, Math.round(img.width * 0.026))}px Microsoft YaHei, sans-serif`;
    ctx.textBaseline = "middle";
    for (const item of annotations || []) {
      const text = String(item.text || "").trim();
      if (!text) continue;
      const x = clamp(Number(item.x || 50), 0, 100) / 100 * img.width;
      const y = clamp(Number(item.y || 50), 0, 100) / 100 * img.height;
      const padX = 14;
      const padY = 8;
      const metrics = ctx.measureText(text);
      const bw = metrics.width + padX * 2;
      const bh = Math.max(34, Math.round(img.width * 0.042));
      ctx.fillStyle = "rgba(15,23,42,.82)";
      roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(text, x - metrics.width / 2, y);
    }
    return canvas.toDataURL("image/png");
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  async function splitImageIntoStoryboardNodes(node, dialog) {
    const source = mediaFromNode(node);
    if (!source) throw new Error("这个节点没有可拆分的图片");
    const img = await loadImage(source);
    const rows = clamp(Math.round(Number(dialog.rows || 2)), 1, 8);
    const cols = clamp(Math.round(Number(dialog.cols || 2)), 1, 8);
    const notes = dialog.notes || [];
    pushHistory();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(img.width / cols));
        canvas.height = Math.max(1, Math.floor(img.height / rows));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, col * canvas.width, row * canvas.height, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        const media = await uploadCanvasImage(dataUrl);
        const index = row * cols + col;
        const frame = makeNode("storyboardFrame", node.x + 410 + col * 390, node.y + row * 310, {
          title: `分镜 ${index + 1}`,
          index: index + 1,
          prompt: notes[index] || "",
          story: notes[index] || "",
          videoDesc: notes[index] || "",
          imageUrl: media,
          outputUrl: media,
          src: media,
          localPreview: media === dataUrl,
        });
        state.canvas.nodes.push(frame);
        connect(node.id, frame.id, false);
      }
    }
    state.toolDialog = null;
    render();
    scheduleSave();
    setStatus(`已拆分 ${rows * cols} 个分镜帧`);
  }

  async function applyToolDialog() {
    const dialog = state.toolDialog;
    if (!dialog) return;
    const node = nodeById(dialog.nodeId);
    if (!node) return;
    const source = mediaFromNode(node);
    if (!source) throw new Error("这个节点没有可处理的图片");
    if (dialog.type === "splitStoryboard") {
      await splitImageIntoStoryboardNodes(node, dialog);
      return;
    }
    let dataUrl = source;
    if (dialog.type === "crop") dataUrl = await cropImageToDataUrl(source, dialog);
    if (dialog.type === "annotate") dataUrl = await annotateImageToDataUrl(source, dialog.annotations || []);
    const media = await uploadCanvasImage(dataUrl);
    addNode("image", node.x + 410, node.y, {
      title: dialog.type === "crop" ? "裁剪结果" : "标注结果",
      imageUrl: media,
      outputUrl: media,
      src: media,
      localPreview: media === dataUrl,
    }, node.id);
    state.toolDialog = null;
    render();
    setStatus("已生成图片节点");
  }

  async function capturePanoView(node) {
    const url = node.data.panoramaUrl || node.data.imageUrl || node.data.outputUrl || node.data.src;
    if (!url) throw new Error("请先上传全景图");
    const immersive = state.toolDialog?.type === "panoImmersive" && state.toolDialog.nodeId === node.id
      ? state.panoramaViewers.get("__immersive__")?.instance
      : null;
    const live = immersive || state.panoramaViewers.get(node.id)?.instance;
    let dataUrl = live?.captureDataUrl?.(960, 540);
    if (!dataUrl) {
      const api = await ensurePanoramaViewerModule();
      dataUrl = await api.capturePanoramaUrl(url, {
        width: 960,
        height: 540,
        yaw: Number(node.data.panoYawDeg ?? api.legacyYawToDeg?.(node.data || {}) ?? 0),
        pitch: Number(node.data.panoPitchDeg ?? api.legacyPitchToDeg?.(node.data || {}) ?? 0),
        fov: Number(node.data.panoFov || 75),
      });
    }
    const media = await uploadCanvasImage(dataUrl);
    addNode("image", node.x + 318, node.y, {
      title: `${node.data.title || "全景"} 当前视角`,
      imageUrl: media,
      outputUrl: media,
      src: media,
      localPreview: media === dataUrl,
    }, node.id);
    setStatus("全景当前视角已生成图片节点");
  }

  async function captureVisualNode(node) {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    const d = node.data || {};
    const bg = d.imageUrl || d.outputUrl || d.src || d.panoramaUrl;
    ctx.fillStyle = "#edf3fb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (bg) {
      try {
        const img = await loadImage(bg);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch {}
    }
    if (node.type === "director") {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 6;
      ctx.strokeRect(96, 72, 768, 396);
      ctx.setLineDash([22, 16]);
      ctx.beginPath();
      ctx.moveTo(150, 454);
      ctx.bezierCurveTo(340, 400, 560, 520, 810, 410);
      ctx.strokeStyle = "#9333ea";
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (node.type === "director") {
      drawDirector3D(ctx, canvas.width, canvas.height, d);
    } else {
      const yaw = Number(d.actorYaw ?? d.yaw ?? 0);
      const x = clamp(Number(d.actorX ?? 50), 4, 96) / 100 * canvas.width;
      const y = clamp(Number(d.actorY ?? 58), 8, 92) / 100 * canvas.height;
      const arm = Number(d.armAngle ?? 0);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((yaw * Math.PI) / 180);
      drawStickFigure(ctx, 1.8, arm);
      ctx.restore();
    }
    ctx.fillStyle = "rgba(15,23,42,.72)";
    ctx.fillRect(24, 24, 360, 38);
    ctx.fillStyle = "#fff";
    ctx.font = "700 22px Microsoft YaHei, sans-serif";
    ctx.fillText(node.type === "director" ? "导演台截图" : "角色站位截图", 42, 50);
    setStatus("正在保存截图...");
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const media = await uploadCanvasImage(dataUrl);
    addNode("image", node.x + 318, node.y, {
      title: `${node.data.title || NODE_TYPES[node.type].title} 截图`,
      imageUrl: media,
      outputUrl: media,
      src: media,
      localPreview: media === dataUrl,
    }, node.id);
    setStatus("截图已生成图片节点");
  }

  function drawDirector3D(ctx, width, height, d) {
    ctx.save();
    ctx.strokeStyle = "rgba(100,116,139,.55)";
    ctx.lineWidth = 2;
    for (let i = -6; i <= 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(width / 2 + i * 54, height - 24);
      ctx.lineTo(width / 2 + i * 26, height * 0.58);
      ctx.stroke();
    }
    for (let j = 0; j < 6; j += 1) {
      const yy = height - 26 - j * 38;
      ctx.beginPath();
      ctx.moveTo(90 + j * 36, yy);
      ctx.lineTo(width - 90 - j * 36, yy);
      ctx.stroke();
    }
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 5;
    ctx.strokeRect(width * 0.1, height * 0.13, width * 0.8, height * 0.68);
    ctx.strokeStyle = "rgba(147,51,234,.7)";
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.moveTo(width * 0.18, height * 0.82);
    ctx.bezierCurveTo(width * 0.36, height * 0.72, width * 0.56, height * 0.9, width * 0.82, height * 0.74);
    ctx.stroke();
    ctx.setLineDash([]);
    const people = resolveDirectorHumans(d).sort((a, b) => a.y - b.y);
    for (const person of people) drawHuman3DOnCanvas(ctx, width, height, person);
    ctx.restore();
  }

  function drawHuman3DOnCanvas(ctx, width, height, person) {
    const x = clamp(Number(person.x || 50), 4, 96) / 100 * width;
    const y = clamp(Number(person.y || 58), 10, 94) / 100 * height;
    const scale = Number(person.scale || 1);
    const yaw = ((Number(person.yaw || 0) % 360) + 360) % 360;
    const side = Math.abs(Math.sin((yaw * Math.PI) / 180));
    const torsoW = (54 - side * 16) * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(15,23,42,.18)";
    ctx.beginPath();
    ctx.ellipse(0, 70, 48, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createLinearGradient(-40, -90, 40, 60);
    grad.addColorStop(0, "#f8fafc");
    grad.addColorStop(1, "#64748b");
    ctx.fillStyle = "#64748b";
    roundRect(ctx, -30, -46, 60, 70, 18);
    ctx.fill();
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -78, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, -torsoW / 2, -46, torsoW, 70, 18);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-torsoW / 2, -28);
    ctx.lineTo(-44, 18);
    ctx.moveTo(torsoW / 2, -28);
    ctx.lineTo(44, 18);
    ctx.moveTo(-14, 20);
    ctx.lineTo(-24, 78);
    ctx.moveTo(14, 20);
    ctx.lineTo(24, 78);
    ctx.stroke();
    if (person.label) {
      ctx.fillStyle = "rgba(15,23,42,.72)";
      roundRect(ctx, -16, -120, 32, 18, 9);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(person.label), 0, -107);
    }
    ctx.restore();
  }

  function drawStickFigure(ctx, scale, armAngle = 0) {
    ctx.strokeStyle = "#111827";
    ctx.fillStyle = "rgba(255,255,255,.74)";
    ctx.lineWidth = 5 * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, -70 * scale, 18 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -52 * scale);
    ctx.lineTo(0, 24 * scale);
    ctx.save();
    ctx.translate(0, -18 * scale);
    ctx.rotate((armAngle * Math.PI) / 180);
    ctx.moveTo(-44 * scale, 0);
    ctx.lineTo(44 * scale, 0);
    ctx.restore();
    ctx.moveTo(0, 24 * scale);
    ctx.lineTo(-34 * scale, 84 * scale);
    ctx.moveTo(0, 24 * scale);
    ctx.lineTo(34 * scale, 84 * scale);
    ctx.stroke();
  }

  function createImageNodeFromFrame(node) {
    addNode("image2image", node.x + 318, node.y, {
      title: `${node.data.title || "镜头"} 图生图`,
      prompt: node.data.prompt || "",
    }, node.id);
  }

  function createVideoNodeFromFrame(node) {
    addNode("image2video", node.x + 318, node.y + 172, {
      title: `${node.data.title || "镜头"} 视频`,
      prompt: node.data.videoDesc || node.data.prompt || "",
      duration: Number(node.data.duration) || 5,
    }, node.id);
  }

  function renderLaunchers() {
    if (root.querySelector(".tf-fc-launch")) return;
    const save = document.createElement("button");
    save.className = "tf-fc-quick-save";
    save.textContent = "保存画布";
    save.onclick = () => run(() => saveCanvas(true));
    root.appendChild(save);

    const launch = document.createElement("button");
    launch.className = "tf-fc-launch";
    launch.textContent = "自由画布";
    launch.onclick = openShell;
    root.appendChild(launch);
  }

  async function openShell() {
    state.open = true;
    const ids = detectIds();
    state.projectId = state.projectId || ids.projectId;
    state.scriptId = state.scriptId || ids.scriptId;
    render();
    await loadModels();
    if (state.projectId && state.scriptId) await run(loadCanvas);
    else render();
  }

  function closeShell() {
    state.open = false;
    state.menu = null;
    destroyDirectorStudio();
    destroyInlineDirectorStudios();
    destroyPanoramaViewers();
    render();
  }

  function toolbarButton(action, iconName, title, extra = "") {
    return `<button class="tf-fc-btn icon ${extra}" data-action="${action}" title="${attr(title)}">${icon(iconName)}</button>`;
  }

  function render() {
    renderLaunchers();
    let shell = root.querySelector(".tf-fc-shell");
    if (!state.open) {
      if (shell) shell.remove();
      return;
    }
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "tf-fc-shell";
      root.appendChild(shell);
    }
    shell.innerHTML = `
      <div class="tf-fc-stage">
        <div class="tf-fc-canvas">
          <svg class="tf-fc-edges">${edgeDefs()}${state.canvas.edges.map(renderEdge).join("")}</svg>
          ${state.canvas.nodes.map(renderNode).join("")}
        </div>
      </div>
      <div class="tf-fc-topbar">
        <div class="tf-fc-brand">
          <button class="tf-fc-btn icon" data-action="close" title="返回上一级">${icon("back")}</button>
          <div class="tf-fc-title">视频生成 · 自由分镜画布</div>
          <span class="tf-fc-chip">${VERSION}</span>
        </div>
        <div class="tf-fc-toolbar">
          <button class="tf-fc-btn primary" data-action="openMenu">${icon("plus")} 新建节点</button>
          <div class="tf-fc-divider"></div>
          ${toolbarButton("undo", "undo", "撤销")}
          ${toolbarButton("redo", "redo", "重做")}
          ${toolbarButton("zoomOut", "zoomOut", "缩小")}
          <span class="tf-fc-zoom-readout">${Math.round(state.canvas.viewport.zoom * 100)}%</span>
          ${toolbarButton("zoomIn", "zoomIn", "放大")}
          ${toolbarButton("fit", "fit", "适配视图")}
          <div class="tf-fc-divider"></div>
          <button class="tf-fc-btn" data-action="importStoryboard">导入分镜</button>
          <button class="tf-fc-btn" data-action="syncStoryboard">同步分镜表</button>
          <button class="tf-fc-btn" data-action="exportJson">导出</button>
        </div>
        <div class="tf-fc-statusbar">
          <div class="tf-fc-id">项目 <input data-fc="projectId" type="number" value="${state.projectId || ""}"></div>
          <div class="tf-fc-id">剧集 <input data-fc="scriptId" type="number" value="${state.scriptId || ""}"></div>
          <button class="tf-fc-btn" data-action="load">读取</button>
          <div class="tf-fc-status">${html(state.status)}</div>
          <button class="tf-fc-btn primary" data-action="save">${icon("save")} 保存</button>
        </div>
      </div>
      ${state.menu ? renderMenu() : ""}
      ${renderSelectedActions()}
      ${renderMiniMap()}
      ${renderInspector()}
      ${renderToolDialog()}
      ${renderImmersivePanorama()}
      <input class="tf-fc-file tf-fc-import-json" type="file" accept="application/json,.json">
    `;
    applyViewport();
    bindEvents(shell);
    mountDirectorStudio(shell).catch((err) => setStatus(`3D导演台加载失败：${err.message}`));
    mountInlineDirectorStudios(shell).catch((err) => setStatus(`3D预览加载失败：${err.message}`));
    mountPanoramaViewers(shell).catch((err) => setStatus(`VR全景加载失败：${err.message}`));
    mountImmersivePanoramaViewer(shell).catch((err) => setStatus(`沉浸式全景加载失败：${err.message}`));
  }

  function edgeDefs() {
    return `<defs><marker id="tf-fc-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#64748b"></path></marker></defs>`;
  }

  function renderEdge(edge) {
    const from = nodeById(edge.from);
    const to = nodeById(edge.to);
    if (!from || !to) return "";
    const x1 = from.x + nodeWidth(from);
    const y1 = from.y + 76;
    const x2 = to.x;
    const y2 = to.y + 76;
    const dx = Math.max(72, Math.abs(x2 - x1) / 2);
    return `<path class="tf-fc-edge" d="M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}"></path>`;
  }

  function isImageLike(node) {
    return ["image", "storyboardFrame", "text2image", "image2image", "image2video", "panorama"].includes(node.type);
  }

  function nodeWidth(node) {
    return isImageLike(node) ? 360 : node.type === "note" ? 320 : NODE_W;
  }

  function renderNode(node) {
    const cfg = NODE_TYPES[node.type] || NODE_TYPES.image;
    const d = node.data || {};
    const selected = state.selectedId === node.id ? " selected" : "";
    const media = renderNodeMedia(node);
    const primary = d.prompt || d.videoDesc || d.story || d.note || d.videoState || d.state || cfg.desc;
    const nodeClass = `${isImageLike(node) ? " image-like" : ""}${node.type === "note" ? " text-like" : ""}`;
    const promptValue = d.prompt || d.videoDesc || d.story || "";
    const promptEditable = ["text2image", "image2image", "image2video", "storyboardFrame"].includes(node.type);
    const chips = [
      node.type === "storyboardFrame" && d.duration ? `${d.duration}s` : "",
      d.shotType || "",
      d.videoState || d.state || "",
      d.sourceFileName || "",
    ].filter(Boolean);
    return `
      <div class="tf-fc-node${nodeClass}${selected}" data-node="${node.id}" style="left:${node.x}px;top:${node.y}px">
        ${renderNodeToolbar(node)}
        <button class="tf-fc-handle in" data-connect-target="${node.id}" title="连接到这个节点">+</button>
        <button class="tf-fc-handle out ${state.connectingFrom === node.id ? "active" : ""}" data-connect-source="${node.id}" title="从这里连线">+</button>
        <div class="tf-fc-node-head" data-drag-node="${node.id}">
          <span class="tf-fc-badge" style="background:${cfg.color}">${cfg.badge}</span>
          <span class="tf-fc-node-title">${html(d.title || cfg.title)}</span>
        </div>
        <div class="tf-fc-node-body">
          ${media}
          ${promptEditable ? `<textarea class="tf-fc-prompt-inline" data-node-field="${node.id}:prompt" placeholder="输入画面描述、动作或生成提示词">${html(promptValue)}</textarea>` : `<div class="tf-fc-small">${html(String(primary).slice(0, 108))}</div>`}
          ${chips.length ? `<div class="tf-fc-node-row">${chips.map((chip) => `<span class="tf-fc-chip-dark">${html(chip)}</span>`).join("")}</div>` : ""}
        </div>
      </div>
    `;
  }

  function renderNodeToolbar(node) {
    const hasImage = !!mediaFromNode(node);
    const canGenerateImage = node.type === "text2image" || node.type === "image2image";
    const canGenerateVideo = node.type === "image2video";
    const tools = [];
    tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:upload" title="上传图片/视频">${icon("upload")}</button>`);
    if (hasImage) {
      tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:view" title="查看大图">${icon("fit")}</button>`);
      tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:crop" title="裁剪">${icon("frame")}</button>`);
      tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:annotate" title="标注">${icon("edit")}</button>`);
      tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:splitStoryboard" title="拆分分镜">${icon("split")}</button>`);
      tools.push(`<span class="tf-fc-tool-sep"></span>`);
    }
    if (node.type === "storyboardFrame") {
      tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:makeImageNode">接图</button>`);
      tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:makeVideoNode">接视频</button>`);
    }
    if (canGenerateImage) tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:generateImage">${icon("spark")} 生图</button>`);
    if (canGenerateVideo) tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:generateVideo">${icon("video")} 视频</button>`);
    tools.push(`<button class="tf-fc-tool-btn" data-node-op="${node.id}:connect" title="新建下游节点">${icon("plus")}</button>`);
    tools.push(`<button class="tf-fc-tool-btn danger" data-node-op="${node.id}:delete" title="删除">${icon("trash")}</button>`);
    return `<div class="tf-fc-node-tools">${tools.join("")}</div>`;
  }

  function renderNodeMedia(node) {
    const d = node.data || {};
    const image = d.outputUrl || d.imageUrl || d.panoramaUrl || d.src;
    if (d.videoUrl) return `<div class="tf-fc-thumb"><video src="${attr(d.videoUrl)}" controls muted></video></div>`;
    if (node.type === "panorama" && image) {
      return `<div class="tf-fc-vr-host" data-pano-vr-host="${node.id}"></div>`;
    }
    if (node.type === "actor") return renderDirectorPreview({ ...node, type: "director" });
    if (node.type === "director") return renderDirectorPreview(node);
    if (image) return `<div class="tf-fc-thumb large" data-node-view="${node.id}"><img src="${attr(image)}" alt=""></div>`;
    if (isImageLike(node)) return `<div class="tf-fc-dropzone" data-drop-node="${node.id}"><div><strong>拖入或上传图片</strong><span>选中节点后点上方上传，也可以直接把图片拖到这里</span></div></div>`;
    if (node.type === "scriptSplit") return `<div class="tf-fc-thumb">输入剧情，一键拆 6-9 镜</div>`;
    if (node.type === "storyboardFrame") return `<div class="tf-fc-thumb">分镜帧</div>`;
    if (node.type === "panorama") return `<div class="tf-fc-thumb">上传全景图后进入VR球面预览</div>`;
    return `<div class="tf-fc-thumb">等待素材或生成结果</div>`;
  }

  function renderStickFigure(d) {
    const yaw = Number(d.actorYaw ?? d.yaw ?? 0);
    const arm = Number(d.armAngle ?? 0);
    const x = clamp(Number(d.actorX ?? 50), 4, 96);
    const y = clamp(Number(d.actorY ?? 58), 8, 92);
    return `<div class="tf-fc-stick" data-stick-node="${attr(d.id || "")}" style="left:${x}%;top:${y}%;transform:translate(-50%,-70%) rotate(${yaw}deg)">
      <span class="head"></span><span class="body"></span><span class="arm" style="transform:rotate(${arm}deg)"></span><span class="leg-l"></span><span class="leg-r"></span>
    </div>`;
  }

  function renderActorPreview(node) {
    const d = node.data || {};
    const image = d.outputUrl || d.imageUrl || d.src || d.panoramaUrl;
    const bg = image ? ` has-bg" style="background-image:url('${attr(image)}')` : "";
    return `<div class="tf-fc-visual${bg}" data-visual-node="${node.id}" title="拖动假人移动，滚轮旋转">
      <span class="tf-fc-visual-label">角色站位</span>
      ${renderStickFigure({ ...d, id: node.id })}
    </div>`;
  }

  function renderDirectorPreview(node) {
    const d = node.data || {};
    if (node.type === "director") {
      return `<div class="tf-fc-director-3d real" data-visual-node="${node.id}">
        <div class="tf-fc-director-inline-host" data-director-inline-host="${node.id}"></div>
        <span class="tf-fc-visual-label">3D导演台</span>
        <button class="tf-fc-director-open" data-director-open="${node.id}" title="打开3D导演台">打开</button>
      </div>`;
    }
    const image = d.outputUrl || d.imageUrl || d.src || d.panoramaUrl;
    const bg = image ? ` has-bg" style="background-image:url('${attr(image)}')` : "";
    const cameraX = clamp(Number(d.cameraX ?? 78), 4, 96);
    const cameraY = clamp(Number(d.cameraY ?? 72), 14, 92);
    const targetX = clamp(Number(d.targetX ?? 50), 4, 96);
    const targetY = clamp(Number(d.targetY ?? 58), 14, 92);
    const dx = targetX - cameraX;
    const dy = targetY - cameraY;
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    const lineAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    return `<div class="tf-fc-director-3d${bg}" data-visual-node="${node.id}" title="拖动移动 3D 假人，滚轮旋转">
      <span class="tf-fc-visual-label">3D导演台</span>
      <button class="tf-fc-director-open" data-director-open="${node.id}" title="打开可旋转的3D导演台">打开3D</button>
      <div class="tf-fc-director-grid"></div>
      <div class="tf-fc-camera-line" style="left:${cameraX}%;top:${cameraY}%;width:${lineLength}%;transform:rotate(${lineAngle}deg)"></div>
      <div class="tf-fc-camera-target" data-camera-target="${node.id}" style="left:${targetX}%;top:${targetY}%"></div>
      <div class="tf-fc-director-camera" data-camera-node="${node.id}" style="left:${cameraX}%;top:${cameraY}%;right:auto;bottom:auto;transform:translate(-50%,-50%) rotateY(${Number(d.cameraYaw || -18)}deg) rotateX(${Number(d.cameraPitch || 0)}deg)"></div>
      ${renderDirectorHumans(d)}
    </div>`;
  }

  function renderDirectorHumans(d) {
    return resolveDirectorHumans(d).map((person) => renderHuman3D(person)).join("");
  }

  function resolveDirectorHumans(d) {
    const mode = String(d.blockingMode || "single");
    const count = clamp(Math.round(Number(d.actorCount || 1)), 1, 80);
    const yaw = Number(d.actorYaw ?? d.yaw ?? 0);
    const pitch = Number(d.actorPitch ?? 0);
    const baseX = clamp(Number(d.actorX ?? 50), 8, 92);
    const baseY = clamp(Number(d.actorY ?? 58), 18, 88);
    if (mode === "matrix") {
      const rows = clamp(Math.round(Number(d.matrixRows || 3)), 1, 8);
      const cols = clamp(Math.round(Number(d.matrixCols || 5)), 1, 12);
      const gapX = clamp(Number(d.matrixGapX || 8), 3, 18);
      const gapY = clamp(Number(d.matrixGapY || 7), 3, 16);
      const total = Math.min(count, rows * cols);
      return Array.from({ length: total }, (_, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          x: baseX + (col - (cols - 1) / 2) * gapX,
          y: baseY + (row - (rows - 1) / 2) * gapY,
          yaw,
          pitch,
          scale: 0.58,
          label: String(index + 1),
        };
      }).sort((a, b) => a.y - b.y);
    }
    if (mode === "duo") {
      return [
        { x: baseX - 8, y: baseY, yaw, pitch, scale: 1, label: "A" },
        { x: baseX + 8, y: baseY + 2, yaw: yaw + 18, pitch, scale: 1, label: "B" },
      ];
    }
    if (mode === "trio") {
      return [
        { x: baseX, y: baseY - 3, yaw, pitch, scale: 1, label: "A" },
        { x: baseX - 10, y: baseY + 6, yaw: yaw + 18, pitch, scale: .92, label: "B" },
        { x: baseX + 10, y: baseY + 6, yaw: yaw - 18, pitch, scale: .92, label: "C" },
      ];
    }
    return [{ x: baseX, y: baseY, yaw, pitch, scale: 1, label: "A" }];
  }

  function renderHuman3D(person) {
    const scale = Number(person.scale || 1);
    const klass = scale < 0.8 ? " soldier" : "";
    return `<div class="tf-fc-human3d${klass}" style="left:${clamp(person.x, 4, 96)}%;top:${clamp(person.y, 10, 94)}%;transform:translate(-50%,-72%) scale(${scale}) rotateX(${Number(person.pitch || 0)}deg) rotateY(${Number(person.yaw || 0)}deg)">
      <span class="tf-fc-human-label">${html(person.label || "")}</span>
      <span class="shadow"></span>
      <span class="depth"></span>
      <span class="side-l"></span>
      <span class="side-r"></span>
      <span class="part head"></span>
      <span class="part torso"></span>
      <span class="part arm-l"></span>
      <span class="part arm-r"></span>
      <span class="part leg-l"></span>
      <span class="part leg-r"></span>
    </div>`;
  }

  function renderMenu() {
    const items = Object.entries(NODE_TYPES).filter(([type]) => type !== "actor");
    return `<div class="tf-fc-menu" style="left:${state.menu.x}px;top:${state.menu.y}px">
      ${items.map(([type, cfg]) => `
        <button data-menu-add="${type}">
          <span class="tf-fc-menu-icon" style="color:${cfg.color}">${icon(cfg.icon)}</span>
          <span><span class="tf-fc-menu-title">${cfg.title}</span><span class="tf-fc-menu-desc">${cfg.desc}</span></span>
        </button>
      `).join("")}
    </div>`;
  }

  function renderSelectedActions() {
    const node = selectedNode();
    if (!node) return "";
    const vp = state.canvas.viewport;
    const left = vp.x + (node.x + NODE_W / 2) * vp.zoom - 96;
    const top = Math.max(62, vp.y + node.y * vp.zoom - 44);
    return `<div class="tf-fc-selected-actions" style="left:${left}px;top:${top}px">
      ${node.type === "scriptSplit" ? toolbarButton("splitScript", "split", "一键拆镜头", "primary") : ""}
      ${node.type === "storyboardFrame" ? `<button class="tf-fc-btn" data-action="makeImageNode">接图生图</button><button class="tf-fc-btn" data-action="makeVideoNode">接视频</button>` : ""}
      ${(node.type === "text2image" || node.type === "image2image") ? toolbarButton("generateImage", "spark", "生成图片", "primary") : ""}
      ${node.type === "image2video" ? toolbarButton("generateVideo", "video", "生成视频", "primary") : ""}
      ${node.type === "panorama" ? `<button class="tf-fc-btn primary" data-action="openPanoImmersive">沉浸式</button><button class="tf-fc-btn" data-action="capturePano">当前截图</button><button class="tf-fc-btn" data-action="shot4">4宫格</button><button class="tf-fc-btn" data-action="shot9">9宫格</button>` : ""}
      ${(node.type === "actor" || node.type === "director") ? toolbarButton("captureVisual", "camera", "截图成图") : ""}
      ${toolbarButton("delete", "trash", "删除", "danger")}
    </div>`;
  }

  function renderMiniMap() {
    if (!state.canvas.nodes.length) return `<div class="tf-fc-minimap"></div>`;
    const minX = Math.min(...state.canvas.nodes.map((node) => node.x));
    const minY = Math.min(...state.canvas.nodes.map((node) => node.y));
    const maxX = Math.max(...state.canvas.nodes.map((node) => node.x + nodeWidth(node)));
    const maxY = Math.max(...state.canvas.nodes.map((node) => node.y + NODE_MIN_H));
    const scale = Math.min(154 / Math.max(maxX - minX, 1), 100 / Math.max(maxY - minY, 1));
    const nodes = state.canvas.nodes.map((node) => {
      const cfg = NODE_TYPES[node.type] || NODE_TYPES.image;
      const left = 6 + (node.x - minX) * scale;
      const top = 6 + (node.y - minY) * scale;
      return `<div class="tf-fc-mini-node" style="left:${left}px;top:${top}px;width:${Math.max(6, nodeWidth(node) * scale)}px;height:${Math.max(5, NODE_MIN_H * scale)}px;background:${cfg.color}"></div>`;
    }).join("");
    return `<div class="tf-fc-minimap">${nodes}</div>`;
  }

  function renderToolDialog() {
    const dialog = state.toolDialog;
    if (!dialog) return "";
    const node = nodeById(dialog.nodeId);
    if (!node) return "";
    const image = mediaFromNode(node);
    const titleMap = {
      view: "查看图片",
      crop: "裁剪图片",
      annotate: "标注图片",
      splitStoryboard: "拆分分镜",
    };
    const title = titleMap[dialog.type] || "图片工具";
    const modalTitle = dialog.type === "director3d" ? "3D导演台" : title;
    const rows = Number(dialog.rows || 2);
    const cols = Number(dialog.cols || 2);
    if (dialog.type === "director3d") {
      return `<div class="tf-fc-modal-backdrop" data-modal-backdrop>
      <div class="tf-fc-modal tf-fc-director-modal">
        <div class="tf-fc-modal-head">
          <div class="tf-fc-modal-title">${modalTitle}</div>
          <button class="tf-fc-btn icon" data-tool-close title="关闭">×</button>
        </div>
        <div class="tf-fc-modal-body">
          <div class="tf-fc-director-host" data-director-host="${node.id}"></div>
        </div>
        <div class="tf-fc-modal-foot">
          <button class="tf-fc-btn" data-tool-close>关闭</button>
          <button class="tf-fc-btn" data-director-save>保存导演台</button>
          <button class="tf-fc-btn primary" data-director-capture>${icon("camera")} 截图成节点</button>
        </div>
      </div>
    </div>`;
    }
    return `<div class="tf-fc-modal-backdrop" data-modal-backdrop>
      <div class="tf-fc-modal">
        <div class="tf-fc-modal-head">
          <div class="tf-fc-modal-title">${title}</div>
          <button class="tf-fc-btn icon" data-tool-close title="关闭">×</button>
        </div>
        <div class="tf-fc-modal-body">
          <div class="tf-fc-tool-canvas">
            ${dialog.type === "splitStoryboard" ? renderStoryboardSplitPreview(image, rows, cols, dialog.notes || []) : renderImageToolPreview(image, dialog)}
          </div>
          <div class="tf-fc-tool-side">
            ${renderToolOptions(dialog)}
          </div>
        </div>
        <div class="tf-fc-modal-foot">
          <button class="tf-fc-btn" data-tool-close>取消</button>
          ${dialog.type === "view" ? "" : `<button class="tf-fc-btn primary" data-tool-apply>生成节点</button>`}
        </div>
      </div>
    </div>`;
  }

  function renderImageToolPreview(image, dialog) {
    if (!image) return `<div class="tf-fc-empty">这个节点没有可处理的图片</div>`;
    const annotations = (dialog.annotations || []).map((item) => (
      `<span class="tf-fc-annotation" style="left:${Number(item.x || 50)}%;top:${Number(item.y || 50)}%">${html(item.text || "标注")}</span>`
    )).join("");
    const crop = dialog.type === "crop"
      ? `<div class="tf-fc-crop-box" style="left:${Number(dialog.cropX || 15)}%;top:${Number(dialog.cropY || 15)}%;width:${Number(dialog.cropW || 70)}%;height:${Number(dialog.cropH || 70)}%"></div>`
      : "";
    return `<img src="${attr(image)}" alt=""><div class="tf-fc-annotate-layer">${annotations}${crop}</div>`;
  }

  function renderStoryboardSplitPreview(image, rows, cols, notes) {
    if (!image) return `<div class="tf-fc-empty">这个节点没有可拆分的图片</div>`;
    const count = rows * cols;
    return `<div class="tf-fc-storyboard-grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">
      ${Array.from({ length: count }, (_, index) => `<div class="tf-fc-story-card">
        <img src="${attr(image)}" alt="" style="object-position:${cols === 1 ? 50 : (index % cols) * 100 / Math.max(1, cols - 1)}% ${rows === 1 ? 50 : Math.floor(index / cols) * 100 / Math.max(1, rows - 1)}%">
        <textarea data-tool-note="${index}" placeholder="镜头 ${index + 1} 描述">${html(notes[index] || "")}</textarea>
      </div>`).join("")}
    </div>`;
  }

  function renderToolOptions(dialog) {
    if (dialog.type === "crop") {
      return `
        <div class="tf-fc-field-grid">${field("左%", "tool:cropX", dialog.cropX ?? 15, "number")}${field("上%", "tool:cropY", dialog.cropY ?? 15, "number")}</div>
        <div class="tf-fc-field-grid">${field("宽%", "tool:cropW", dialog.cropW ?? 70, "number")}${field("高%", "tool:cropH", dialog.cropH ?? 70, "number")}</div>
        <div class="tf-fc-small">按百分比裁剪当前图片，应用后会在右侧生成一个新的图片节点。</div>
      `;
    }
    if (dialog.type === "annotate") {
      return `
        ${field("标注文字", "tool:annotationText", dialog.annotationText || "重点画面")}
        <div class="tf-fc-field-grid">${field("位置 X%", "tool:annotationX", dialog.annotationX ?? 50, "number")}${field("位置 Y%", "tool:annotationY", dialog.annotationY ?? 50, "number")}</div>
        <button class="tf-fc-btn" data-tool-add-annotation>添加标注</button>
        <div class="tf-fc-small">标注会烘焙到新图片节点里，可继续接图生图或图生视频。</div>
      `;
    }
    if (dialog.type === "splitStoryboard") {
      return `
        <div class="tf-fc-field-grid">${field("行", "tool:rows", dialog.rows ?? 2, "number")}${field("列", "tool:cols", dialog.cols ?? 2, "number")}</div>
        <div class="tf-fc-small">把一张分镜大图拆成多个分镜帧节点，每个格子可填写镜头说明。</div>
      `;
    }
    return `<div class="tf-fc-small">双击图片节点也可以快速查看大图。</div>`;
  }

  function renderInspector() {
    const node = selectedNode();
    if (!node) {
      return `<div class="tf-fc-inspector">
        <div class="tf-fc-inspector-head"><div class="tf-fc-inspector-title">属性面板</div></div>
        <div class="tf-fc-inspector-body"><div class="tf-fc-empty">在画布空白处双击或点击“新建节点”添加节点。滚轮缩放，按住空白区域拖动画布。选中节点后可上传、生成、接图、接视频、拆镜头、截取全景图。</div></div>
      </div>`;
    }
    const cfg = NODE_TYPES[node.type] || NODE_TYPES.image;
    const d = node.data || {};
    return `<div class="tf-fc-inspector">
      <div class="tf-fc-inspector-head">
        <div class="tf-fc-inspector-title">${cfg.title}</div>
        <span class="tf-fc-chip">${incoming(node.id).length} 入 / ${outgoing(node.id).length} 出</span>
      </div>
      <div class="tf-fc-inspector-body">
        ${field("节点名称", "title", d.title || cfg.title)}
        ${textarea(node.type === "scriptSplit" ? "剧情内容" : "画面提示词", "prompt", d.prompt || "")}
        ${node.type === "scriptSplit" ? scriptSplitFields(d) : ""}
        ${node.type === "storyboardFrame" ? storyboardFields(d) : ""}
        ${node.type === "director" ? directorFields(d) : ""}
        ${node.type === "actor" ? actorFields(d) : ""}
        ${node.type === "panorama" ? panoramaFields(d) : ""}
        ${["text2image", "image2image", "image2video"].includes(node.type) ? generationFields(node, d) : ""}
        ${textarea("备注", "note", d.note || "")}
        <div class="tf-fc-ops">${operationButtons(node)}</div>
        <input class="tf-fc-file tf-fc-upload" type="file" accept="image/*,video/mp4,video/webm">
      </div>
    </div>`;
  }

  function field(label, key, value, type = "text") {
    return `<div class="tf-fc-field"><label>${label}</label><input data-field="${key}" type="${type}" value="${attr(value)}"></div>`;
  }

  function textarea(label, key, value) {
    return `<div class="tf-fc-field"><label>${label}</label><textarea data-field="${key}">${html(value)}</textarea></div>`;
  }

  function selectField(label, key, value, options) {
    return `<div class="tf-fc-field"><label>${label}</label><select data-field="${key}">${options.map((opt) => `<option value="${attr(opt.value)}" ${String(value || "") === String(opt.value) ? "selected" : ""}>${html(opt.label)}</option>`).join("")}</select></div>`;
  }

  function scriptSplitFields(d) {
    return `<div class="tf-fc-field-grid">${field("镜头数量", "targetCount", d.targetCount || 8, "number")}${selectField("拆分模式", "splitMode", d.splitMode || "auto", [{ value: "auto", label: "自动 6-9 镜" }, { value: "manual", label: "生成后手动改" }])}</div>`;
  }

  function storyboardFields(d) {
    return `
      <div class="tf-fc-field-grid">${field("镜头序号", "index", d.index || "", "number")}${field("时长/秒", "duration", d.duration || 5, "number")}</div>
      ${textarea("剧情/动作", "story", d.story || "")}
      ${textarea("视频描述", "videoDesc", d.videoDesc || d.prompt || "")}
      <div class="tf-fc-field-grid">${field("景别", "shotType", d.shotType || "")}${field("机位角度", "cameraAngle", d.cameraAngle || "")}</div>
      ${field("镜头运动", "cameraMovement", d.cameraMovement || "")}
      ${textarea("构图", "composition", d.composition || "")}
      ${textarea("角色调度", "actorBlocking", d.actorBlocking || "")}
      ${textarea("情绪节拍", "emotionBeat", d.emotionBeat || "")}
      ${textarea("导演备注", "directorNote", d.directorNote || "")}
    `;
  }

  function directorFields(d) {
    return `
      <div class="tf-fc-field-grid">${field("景别", "shotType", d.shotType || "")}${field("机位角度", "cameraAngle", d.cameraAngle || "")}</div>
      ${field("镜头运动", "cameraMovement", d.cameraMovement || "")}
      ${selectField("站位模式", "blockingMode", d.blockingMode || "single", [{ value: "single", label: "单人" }, { value: "duo", label: "双人对戏" }, { value: "trio", label: "三人调度" }, { value: "matrix", label: "矩阵/队列" }])}
      <div class="tf-fc-field-grid">${field("3D人偶左右%", "actorX", d.actorX ?? 50, "number")}${field("3D人偶前后%", "actorY", d.actorY ?? 58, "number")}</div>
      <div class="tf-fc-field-grid">${field("人偶水平旋转", "actorYaw", d.actorYaw ?? d.yaw ?? 0, "number")}${field("人偶俯仰", "actorPitch", d.actorPitch ?? 0, "number")}</div>
      <div class="tf-fc-field-grid">${field("人数/队列人数", "actorCount", d.actorCount ?? 1, "number")}${field("矩阵行数", "matrixRows", d.matrixRows ?? 3, "number")}</div>
      <div class="tf-fc-field-grid">${field("矩阵列数", "matrixCols", d.matrixCols ?? 5, "number")}${field("队列间距", "matrixGapX", d.matrixGapX ?? 8, "number")}</div>
      <div class="tf-fc-field-grid">${field("摄像机X%", "cameraX", d.cameraX ?? 78, "number")}${field("摄像机Y%", "cameraY", d.cameraY ?? 72, "number")}</div>
      <div class="tf-fc-field-grid">${field("目标点X%", "targetX", d.targetX ?? 50, "number")}${field("目标点Y%", "targetY", d.targetY ?? 58, "number")}</div>
      <div class="tf-fc-field-grid">${field("机位水平", "cameraYaw", d.cameraYaw ?? -18, "number")}${field("机位俯仰", "cameraPitch", d.cameraPitch ?? 0, "number")}</div>
      ${textarea("调度/转场/情绪", "directorNote", d.directorNote || d.note || "")}
    `;
  }

  function actorFields(d) {
    return `
      ${field("角色名称", "characterName", d.characterName || "")}
      <div class="tf-fc-field-grid">${field("左右%", "actorX", d.actorX ?? 50, "number")}${field("上下%", "actorY", d.actorY ?? 58, "number")}</div>
      <div class="tf-fc-field-grid">${field("身体旋转", "actorYaw", d.actorYaw ?? d.yaw ?? 0, "number")}${field("手臂角度", "armAngle", d.armAngle ?? 0, "number")}</div>
      ${textarea("位置/姿势/动作/视线", "pose", d.pose || "")}
    `;
  }

  function panoramaFields(d) {
    return `
      <div class="tf-fc-field-grid">
        ${selectField("全景类型", "mode", d.mode || "360", [{ value: "360", label: "360" }, { value: "720", label: "720" }])}
        ${field("FOV视野", "panoFov", d.panoFov || 75, "number")}
      </div>
      <div class="tf-fc-field-grid">${field("水平角度", "panoYawDeg", d.panoYawDeg || 0, "number")}${field("俯仰角度", "panoPitchDeg", d.panoPitchDeg || 0, "number")}</div>
      <button class="tf-fc-btn" data-op="resetPanoView">重置VR视角</button>
      <div class="tf-fc-small">上传全景图后，节点内是VR球面浏览器：拖动旋转视角，滚轮调FOV；当前截图、4宫格、9宫格会从真实VR视角生成图片节点。</div>
    `;
  }

  function renderImmersivePanorama() {
    const dialog = state.toolDialog;
    if (!dialog || dialog.type !== "panoImmersive") return "";
    const node = nodeById(dialog.nodeId);
    if (!node) return "";
    return `<div class="tf-fc-vr-immersive">
      <div class="tf-fc-vr-immersive-host" data-pano-immersive-host="${node.id}"></div>
      <div class="tf-fc-vr-immersive-actions">
        <button class="tf-fc-btn" data-pano-immersive-action="capture">${icon("camera")} 当前截图</button>
        <button class="tf-fc-btn" data-pano-immersive-action="shot4">4宫格</button>
        <button class="tf-fc-btn" data-pano-immersive-action="shot9">9宫格</button>
        <button class="tf-fc-btn close" data-pano-immersive-action="close" title="退出">×</button>
      </div>
    </div>`;
  }

  function generationFields(node, d) {
    const models = node.type === "image2video" ? state.models.video : state.models.image;
    const modelOptions = [{ value: "", label: "使用项目默认模型/工作流" }].concat(models.map((item) => ({
      value: item.id && item.value ? `${item.id}:${item.value}` : item.value || item.id || item.name || "",
      label: `${item.label || item.value || "模型"}${item.name ? ` / ${item.name}` : ""}`,
    })));
    const modeOptions = [
      { value: "", label: "自动选择" },
      { value: "text", label: "文生视频" },
      { value: "singleImage", label: "图生视频" },
      { value: "startEndRequired", label: "首尾帧" },
      { value: "multiReference", label: "多参考" },
    ];
    return `
      ${selectField("模型/工作流", "model", d.model || "", modelOptions)}
      ${node.type === "image2video" ? selectField("生成模式", "mode", d.mode || "", modeOptions) : ""}
      <div class="tf-fc-field-grid">
        ${field("时长", "duration", d.duration || 5, "number")}
        ${selectField("清晰度", "resolution", d.resolution || "720p", [{ value: "480p", label: "480p" }, { value: "720p", label: "720p" }, { value: "1080p", label: "1080p" }])}
      </div>
      <div class="tf-fc-field-grid">
        ${selectField("比例", "ratio", d.ratio || "", [{ value: "", label: "项目默认" }, { value: "16:9", label: "16:9" }, { value: "9:16", label: "9:16" }, { value: "1:1", label: "1:1" }, { value: "4:3", label: "4:3" }])}
        ${selectField("质量", "quality", d.quality || "", [{ value: "", label: "项目默认" }, { value: "0.5K", label: "0.5K" }, { value: "1K", label: "1K" }, { value: "2K", label: "2K" }, { value: "4K", label: "4K" }])}
      </div>
    `;
  }

  function operationButtons(node) {
    const directorPrimaryButton = node.type === "director"
      ? `<button class="tf-fc-btn primary" data-op="openDirector3D">${icon("camera")} 打开3D导演台</button>`
      : "";
    const buttons = [
      `<button class="tf-fc-btn" data-op="upload">${icon("upload")} 上传</button>`,
      `<button class="tf-fc-btn" data-op="connect">设为参考源</button>`,
    ];
    if (node.type === "scriptSplit") buttons.unshift(`<button class="tf-fc-btn primary" data-op="splitScript">${icon("split")} 一键拆镜头</button>`);
    if (node.type === "storyboardFrame") {
      buttons.push(`<button class="tf-fc-btn" data-op="makeImageNode">接图生图</button>`);
      buttons.push(`<button class="tf-fc-btn" data-op="makeVideoNode">接图生视频</button>`);
    }
    if (node.type === "text2image" || node.type === "image2image") buttons.push(`<button class="tf-fc-btn primary" data-op="generateImage">${icon("spark")} 生成图片</button>`);
    if (node.type === "image2video") buttons.push(`<button class="tf-fc-btn primary" data-op="generateVideo">${icon("video")} 生成视频</button>`);
    if (node.type === "panorama") {
      buttons.push(`<button class="tf-fc-btn primary" data-op="openPanoImmersive">沉浸式全屏</button>`);
      buttons.push(`<button class="tf-fc-btn" data-op="capturePano">当前视角截图</button>`);
      buttons.push(`<button class="tf-fc-btn" data-op="shot4">4宫格</button>`);
      buttons.push(`<button class="tf-fc-btn" data-op="shot9">9宫格</button>`);
    }
    if (node.type === "actor" || node.type === "director") buttons.push(`<button class="tf-fc-btn" data-op="captureVisual">${icon("camera")} 截图成图</button>`);
    buttons.push(`<button class="tf-fc-btn danger" data-op="delete">${icon("trash")} 删除</button>`);
    return directorPrimaryButton + buttons.join("");
  }

  function bindEvents(shell) {
    const action = (name, fn) => shell.querySelectorAll(`[data-action="${name}"]`).forEach((el) => { el.onclick = fn; });
    action("close", closeShell);
    action("save", () => run(() => saveCanvas(true)));
    action("load", () => run(loadCanvas));
    action("openMenu", (event) => openNodeMenu(event));
    action("undo", undo);
    action("redo", redo);
    action("zoomIn", () => zoomAtCenter(1.2));
    action("zoomOut", () => zoomAtCenter(1 / 1.2));
    action("fit", fitView);
    action("delete", deleteSelected);
    action("importStoryboard", () => run(importCurrentStoryboard));
    action("syncStoryboard", () => run(syncStoryboard));
    action("exportJson", exportCanvasJson);
    action("splitScript", () => selectedNode() && run(() => splitScript(selectedNode())));
    action("generateImage", () => selectedNode() && run(() => generateImage(selectedNode())));
    action("generateVideo", () => selectedNode() && run(() => generateVideo(selectedNode())));
    action("makeImageNode", () => selectedNode() && createImageNodeFromFrame(selectedNode()));
    action("makeVideoNode", () => selectedNode() && createVideoNodeFromFrame(selectedNode()));
    action("captureVisual", () => selectedNode() && run(() => captureVisualNode(selectedNode())));
    action("openDirector3D", () => selectedNode() && openDirectorStudio(selectedNode()));
    action("openPanoImmersive", () => selectedNode() && openPanoImmersive(selectedNode()));
    action("capturePano", () => selectedNode() && run(() => capturePanoView(selectedNode())));
    action("shot4", () => selectedNode() && run(() => makePanoShot(selectedNode(), 4)));
    action("shot9", () => selectedNode() && run(() => makePanoShot(selectedNode(), 9)));

    const importJson = shell.querySelector(".tf-fc-import-json");
    if (importJson) importJson.onchange = (event) => event.target.files?.[0] && importCanvasJson(event.target.files[0]);

    shell.querySelectorAll("[data-menu-add]").forEach((btn) => {
      btn.onclick = () => {
        const world = state.menu?.world || screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        addNode(btn.dataset.menuAdd, world.x, world.y, {}, state.menu?.connectFrom);
      };
    });

    shell.querySelectorAll("[data-node]").forEach((el) => {
      el.onclick = (event) => {
        if (event.target.closest("button")) return;
        state.selectedId = el.dataset.node;
        state.menu = null;
        render();
      };
    });

    shell.querySelectorAll("[data-connect-source]").forEach((btn) => {
      btn.onclick = (event) => {
        event.stopPropagation();
        state.connectingFrom = btn.dataset.connectSource;
        setStatus("已选择参考源，点击目标节点左侧连接点，或在空白处新建下游节点");
        render();
      };
    });

    shell.querySelectorAll("[data-connect-target]").forEach((btn) => {
      btn.onclick = (event) => {
        event.stopPropagation();
        if (!state.connectingFrom) return;
        connect(state.connectingFrom, btn.dataset.connectTarget);
        state.connectingFrom = null;
        render();
        scheduleSave();
      };
    });

    shell.querySelectorAll("[data-field]:not([data-field^='tool:'])").forEach((fieldEl) => {
      fieldEl.oninput = () => {
        const node = selectedNode();
        if (!node) return;
        updateNode(node.id, { [fieldEl.dataset.field]: fieldEl.type === "checkbox" ? fieldEl.checked : fieldEl.value }, false);
        const cardTitle = root.querySelector(`[data-node="${node.id}"] .tf-fc-node-title`);
        if (cardTitle && fieldEl.dataset.field === "title") cardTitle.textContent = fieldEl.value;
        if (["actorX", "actorY", "actorYaw", "actorPitch", "actorCount", "blockingMode", "matrixRows", "matrixCols", "matrixGapX", "matrixGapY", "cameraX", "cameraY", "targetX", "targetY", "cameraYaw", "cameraPitch", "yaw", "armAngle"].includes(fieldEl.dataset.field)) syncSelectedVisualPreview();
        if (["yaw", "pitch", "panoZoom", "panoYawDeg", "panoPitchDeg", "panoFov", "mode"].includes(fieldEl.dataset.field)) syncSelectedPanoPreview();
      };
    });

    shell.querySelectorAll("[data-node-field]").forEach((fieldEl) => {
      fieldEl.oninput = () => {
        const [nodeId, key] = String(fieldEl.dataset.nodeField || "").split(":");
        if (!nodeId || !key) return;
        const patch = { [key]: fieldEl.value };
        if (key === "prompt") {
          patch.videoDesc = fieldEl.value;
          patch.story = fieldEl.value;
        }
        updateNode(nodeId, patch, false);
      };
    });

    const upload = shell.querySelector(".tf-fc-upload");
    if (upload) upload.onchange = () => selectedNode() && upload.files?.[0] && run(() => uploadFile(upload.files[0], selectedNode()));

    shell.querySelectorAll("[data-node-op]").forEach((btn) => {
      btn.onclick = (event) => {
        event.stopPropagation();
        const [nodeId, op] = String(btn.dataset.nodeOp || "").split(":");
        const node = nodeById(nodeId);
        if (!node) return;
        state.selectedId = node.id;
        run(async () => {
          if (op === "upload") upload?.click();
          if (op === "view") state.toolDialog = { type: "view", nodeId: node.id };
          if (op === "crop") state.toolDialog = { type: "crop", nodeId: node.id, cropX: 15, cropY: 15, cropW: 70, cropH: 70 };
          if (op === "annotate") state.toolDialog = { type: "annotate", nodeId: node.id, annotationText: "重点画面", annotationX: 50, annotationY: 50, annotations: [] };
          if (op === "splitStoryboard") state.toolDialog = { type: "splitStoryboard", nodeId: node.id, rows: 2, cols: 2, notes: [] };
          if (op === "connect") { state.connectingFrom = node.id; }
          if (op === "delete") deleteSelected();
          if (op === "makeImageNode") createImageNodeFromFrame(node);
          if (op === "makeVideoNode") createVideoNodeFromFrame(node);
          if (op === "generateImage") await generateImage(node);
          if (op === "generateVideo") await generateVideo(node);
          if (op === "openDirector3D") openDirectorStudio(node);
          render();
        });
      };
    });

    shell.querySelectorAll("[data-drop-node]").forEach((el) => {
      el.ondragover = (event) => { event.preventDefault(); event.stopPropagation(); };
      el.ondrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const node = nodeById(el.dataset.dropNode);
        const file = event.dataTransfer?.files?.[0];
        if (node && file) run(() => uploadFile(file, node));
      };
    });

    shell.querySelectorAll("[data-node-view]").forEach((el) => {
      el.ondblclick = (event) => {
        event.stopPropagation();
        state.toolDialog = { type: "view", nodeId: el.dataset.nodeView };
        render();
      };
    });

    shell.querySelectorAll("[data-tool-close]").forEach((el) => {
      el.onclick = () => { destroyDirectorStudio(); destroyImmersivePanoramaViewer(); state.toolDialog = null; render(); };
    });
    const backdrop = shell.querySelector("[data-modal-backdrop]");
    if (backdrop) backdrop.onclick = (event) => {
      if (event.target === backdrop) { destroyDirectorStudio(); destroyImmersivePanoramaViewer(); state.toolDialog = null; render(); }
    };
    shell.querySelectorAll("[data-director-open]").forEach((el) => {
      el.onclick = (event) => {
        event.stopPropagation();
        const node = nodeById(el.dataset.directorOpen);
        if (node) openDirectorStudio(node);
      };
    });
    shell.querySelectorAll("[data-director-save]").forEach((el) => {
      el.onclick = () => run(saveDirectorStudio);
    });
    shell.querySelectorAll("[data-director-capture]").forEach((el) => {
      el.onclick = () => run(captureDirectorStudio);
    });
    shell.querySelectorAll("[data-pano-immersive-action]").forEach((el) => {
      el.onclick = () => {
        const dialog = state.toolDialog;
        const node = dialog?.type === "panoImmersive" ? nodeById(dialog.nodeId) : null;
        const action = el.dataset.panoImmersiveAction;
        if (action === "close") {
          destroyImmersivePanoramaViewer();
          state.toolDialog = null;
          render();
          return;
        }
        if (!node) return;
        if (action === "capture") run(() => capturePanoView(node));
        if (action === "shot4") run(() => makePanoShot(node, 4));
        if (action === "shot9") run(() => makePanoShot(node, 9));
      };
    });
    shell.querySelectorAll("[data-tool-apply]").forEach((el) => {
      el.onclick = () => run(applyToolDialog);
    });
    shell.querySelectorAll("[data-tool-add-annotation]").forEach((el) => {
      el.onclick = () => {
        if (!state.toolDialog) return;
        state.toolDialog.annotations = [...(state.toolDialog.annotations || []), {
          text: state.toolDialog.annotationText || "重点画面",
          x: Number(state.toolDialog.annotationX || 50),
          y: Number(state.toolDialog.annotationY || 50),
        }];
        render();
      };
    });
    shell.querySelectorAll("[data-tool-note]").forEach((el) => {
      el.oninput = () => {
        if (!state.toolDialog) return;
        const index = Number(el.dataset.toolNote || 0);
        const notes = [...(state.toolDialog.notes || [])];
        notes[index] = el.value;
        state.toolDialog.notes = notes;
      };
    });
    shell.querySelectorAll("[data-field^='tool:']").forEach((fieldEl) => {
      fieldEl.oninput = () => {
        if (!state.toolDialog) return;
        const key = fieldEl.dataset.field.slice(5);
        state.toolDialog[key] = fieldEl.type === "number" ? Number(fieldEl.value) : fieldEl.value;
        render();
      };
    });

    shell.querySelectorAll("[data-op]").forEach((btn) => {
      btn.onclick = () => {
        const node = selectedNode();
        if (!node) return;
        run(async () => {
          if (btn.dataset.op === "upload") upload?.click();
          if (btn.dataset.op === "connect") { state.connectingFrom = node.id; render(); }
          if (btn.dataset.op === "delete") deleteSelected();
          if (btn.dataset.op === "splitScript") await splitScript(node);
          if (btn.dataset.op === "generateImage") await generateImage(node);
          if (btn.dataset.op === "generateVideo") await generateVideo(node);
          if (btn.dataset.op === "openDirector3D") openDirectorStudio(node);
          if (btn.dataset.op === "openPanoImmersive") openPanoImmersive(node);
          if (btn.dataset.op === "makeImageNode") createImageNodeFromFrame(node);
          if (btn.dataset.op === "makeVideoNode") createVideoNodeFromFrame(node);
          if (btn.dataset.op === "captureVisual") await captureVisualNode(node);
          if (btn.dataset.op === "capturePano") await capturePanoView(node);
          if (btn.dataset.op === "shot4") await makePanoShot(node, 4);
          if (btn.dataset.op === "shot9") await makePanoShot(node, 9);
          if (btn.dataset.op === "resetPanoView") {
            updateNode(node.id, { panoYawDeg: 0, panoPitchDeg: 0, panoFov: 75, yaw: 0, pitch: 50 }, true);
          }
        });
      };
    });

    bindCanvasInteractions(shell);
    bindNodeDragging(shell);
    bindVisualNodeControls(shell);
  }

  function openNodeMenu(event, connectFrom) {
    const x = event?.clientX ? event.clientX : window.innerWidth / 2;
    const y = event?.clientY ? event.clientY : 90;
    state.menu = {
      x: Math.min(x, window.innerWidth - 266),
      y: Math.min(y + 8, window.innerHeight - 520),
      world: screenToWorld(x, y),
      connectFrom: connectFrom || state.connectingFrom || null,
    };
    render();
  }

  function applyViewport() {
    const canvas = root.querySelector(".tf-fc-canvas");
    if (!canvas) return;
    const vp = state.canvas.viewport;
    canvas.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`;
    const stage = root.querySelector(".tf-fc-stage");
    if (stage) {
      stage.style.backgroundSize = `${22 * vp.zoom}px ${22 * vp.zoom}px`;
      stage.style.backgroundPosition = `${vp.x}px ${vp.y}px`;
    }
  }

  function zoomAt(clientX, clientY, nextZoom) {
    const stage = root.querySelector(".tf-fc-stage");
    const rect = stage.getBoundingClientRect();
    const vp = state.canvas.viewport;
    const before = { x: (clientX - rect.left - vp.x) / vp.zoom, y: (clientY - rect.top - vp.y) / vp.zoom };
    vp.zoom = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
    vp.x = clientX - rect.left - before.x * vp.zoom;
    vp.y = clientY - rect.top - before.y * vp.zoom;
    applyViewport();
    updateZoomReadout();
  }

  function zoomAtCenter(factor) {
    const stage = root.querySelector(".tf-fc-stage");
    const rect = stage.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, state.canvas.viewport.zoom * factor);
    scheduleSave();
  }

  function updateZoomReadout() {
    const el = root.querySelector(".tf-fc-zoom-readout");
    if (el) el.textContent = `${Math.round(state.canvas.viewport.zoom * 100)}%`;
  }

  function fitView() {
    if (!state.canvas.nodes.length) {
      state.canvas.viewport = { x: 80, y: 110, zoom: 1 };
      applyViewport();
      return;
    }
    const stage = root.querySelector(".tf-fc-stage");
    const rect = stage.getBoundingClientRect();
    const minX = Math.min(...state.canvas.nodes.map((node) => node.x));
    const minY = Math.min(...state.canvas.nodes.map((node) => node.y));
    const maxX = Math.max(...state.canvas.nodes.map((node) => node.x + nodeWidth(node)));
    const maxY = Math.max(...state.canvas.nodes.map((node) => node.y + NODE_MIN_H));
    const zoom = clamp(Math.min((rect.width - 420) / Math.max(maxX - minX, 1), (rect.height - 150) / Math.max(maxY - minY, 1)), 0.28, 1.25);
    state.canvas.viewport = {
      zoom,
      x: 72 - minX * zoom,
      y: 110 - minY * zoom,
    };
    render();
    scheduleSave();
  }

  function bindCanvasInteractions(shell) {
    const stage = shell.querySelector(".tf-fc-stage");
    if (!stage) return;
    stage.onwheel = (event) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      zoomAt(event.clientX, event.clientY, state.canvas.viewport.zoom * factor);
      scheduleSave();
    };
    stage.ondblclick = (event) => {
      if (event.target !== stage && !event.target.classList.contains("tf-fc-canvas")) return;
      openNodeMenu(event, state.connectingFrom);
    };
    stage.onpointerdown = (event) => {
      if (event.button !== 0) return;
      if (event.target.closest(".tf-fc-node,.tf-fc-topbar,.tf-fc-inspector,.tf-fc-menu,.tf-fc-selected-actions,.tf-fc-minimap")) return;
      state.menu = null;
      state.selectedId = null;
      state.pointer = { kind: "pan", id: event.pointerId, startX: event.clientX, startY: event.clientY, baseX: state.canvas.viewport.x, baseY: state.canvas.viewport.y };
      stage.classList.add("dragging");
      stage.setPointerCapture(event.pointerId);
      root.querySelector(".tf-fc-selected-actions")?.remove();
      root.querySelector(".tf-fc-menu")?.remove();
    };
    stage.onpointermove = (event) => {
      if (!state.pointer || state.pointer.kind !== "pan") return;
      state.canvas.viewport.x = state.pointer.baseX + event.clientX - state.pointer.startX;
      state.canvas.viewport.y = state.pointer.baseY + event.clientY - state.pointer.startY;
      applyViewport();
    };
    stage.onpointerup = () => {
      if (!state.pointer || state.pointer.kind !== "pan") return;
      state.pointer = null;
      stage.classList.remove("dragging");
      scheduleSave();
    };
  }

  function bindNodeDragging(shell) {
    shell.querySelectorAll("[data-drag-node]").forEach((head) => {
      head.onpointerdown = (event) => {
        const node = nodeById(head.dataset.dragNode);
        if (!node) return;
        event.preventDefault();
        event.stopPropagation();
        pushHistory();
        state.selectedId = node.id;
        state.menu = null;
        const card = head.closest(".tf-fc-node");
        const startX = event.clientX;
        const startY = event.clientY;
        const baseX = node.x;
        const baseY = node.y;
        const zoom = state.canvas.viewport.zoom || 1;
        head.setPointerCapture(event.pointerId);
        head.onpointermove = (moveEvent) => {
          node.x = Math.round(baseX + (moveEvent.clientX - startX) / zoom);
          node.y = Math.round(baseY + (moveEvent.clientY - startY) / zoom);
          if (card) {
            card.style.left = `${node.x}px`;
            card.style.top = `${node.y}px`;
          }
          refreshEdgesAndOverlay();
        };
        head.onpointerup = () => {
          head.onpointermove = null;
          head.onpointerup = null;
          scheduleSave();
          render();
        };
      };
    });
  }

  function syncSelectedVisualPreview() {
    const node = selectedNode();
    if (!node || !["actor", "director"].includes(node.type)) return;
    const d = node.data || {};
    const stage = root.querySelector(`[data-visual-node="${node.id}"]`);
    const human = root.querySelector(`[data-visual-node="${node.id}"] .tf-fc-human3d`);
    if (stage && human) {
      const fresh = renderDirectorPreview(node);
      const wrap = document.createElement("div");
      wrap.innerHTML = fresh;
      const nextStage = wrap.firstElementChild;
      if (nextStage) {
        stage.replaceWith(nextStage);
        bindVisualNodeControls(root);
      }
      const camera = root.querySelector(`[data-visual-node="${node.id}"] .tf-fc-director-camera`);
      if (camera) camera.style.transform = `translate(-50%,-50%) rotateY(${Number(d.cameraYaw || -18)}deg) rotateX(${Number(d.cameraPitch || 0)}deg)`;
      return;
    }
    const stick = root.querySelector(`[data-visual-node="${node.id}"] .tf-fc-stick`);
    if (!stick) return;
    const yaw = Number(d.actorYaw ?? d.yaw ?? 0);
    const x = clamp(Number(d.actorX ?? 50), 4, 96);
    const y = clamp(Number(d.actorY ?? 58), 8, 92);
    stick.style.left = `${x}%`;
    stick.style.top = `${y}%`;
    stick.style.transform = `translate(-50%,-70%) rotate(${yaw}deg)`;
    const arm = stick.querySelector(".arm");
    if (arm) arm.style.transform = `rotate(${Number(d.armAngle ?? 0)}deg)`;
  }

  function syncSelectedPanoPreview() {
    const node = selectedNode();
    if (!node || node.type !== "panorama") return;
    state.panoramaViewers.get(node.id)?.instance?.destroy();
    state.panoramaViewers.delete(node.id);
    render();
  }

  function bindVisualNodeControls(shell) {
    shell.querySelectorAll("[data-camera-node],[data-camera-target]").forEach((el) => {
      el.onpointerdown = (event) => {
        event.stopPropagation();
        const node = nodeById(el.dataset.cameraNode || el.dataset.cameraTarget);
        if (!node) return;
        state.selectedId = node.id;
        const stage = el.closest("[data-visual-node]");
        const rect = stage.getBoundingClientRect();
        el.setPointerCapture(event.pointerId);
        el.onpointermove = (moveEvent) => {
          const x = clamp(((moveEvent.clientX - rect.left) / Math.max(1, rect.width)) * 100, 4, 96);
          const y = clamp(((moveEvent.clientY - rect.top) / Math.max(1, rect.height)) * 100, 10, 94);
          if (el.dataset.cameraNode) {
            node.data.cameraX = Math.round(x);
            node.data.cameraY = Math.round(y);
          } else {
            node.data.targetX = Math.round(x);
            node.data.targetY = Math.round(y);
          }
          syncSelectedVisualPreview();
        };
        el.onpointerup = () => {
          el.onpointermove = null;
          el.onpointerup = null;
          scheduleSave();
          render();
        };
      };
    });
    shell.querySelectorAll("[data-visual-node]").forEach((el) => {
      el.ondblclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const node = nodeById(el.dataset.visualNode);
        if (node) run(() => captureVisualNode(node));
      };
      el.onpointerdown = (event) => {
        event.stopPropagation();
        const node = nodeById(el.dataset.visualNode);
        if (!node) return;
        state.selectedId = node.id;
        const rect = el.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const baseX = Number(node.data.actorX ?? 50);
        const baseY = Number(node.data.actorY ?? 58);
        el.setPointerCapture(event.pointerId);
        el.onpointermove = (moveEvent) => {
          node.data.actorX = Math.round(clamp(baseX + ((moveEvent.clientX - startX) / Math.max(1, rect.width)) * 100, 4, 96));
          node.data.actorY = Math.round(clamp(baseY + ((moveEvent.clientY - startY) / Math.max(1, rect.height)) * 100, 8, 92));
          if (node.type === "director") {
            node.data.targetX = node.data.actorX;
            node.data.targetY = node.data.actorY;
          }
          syncSelectedVisualPreview();
        };
        el.onpointerup = () => {
          el.onpointermove = null;
          el.onpointerup = null;
          scheduleSave();
          render();
        };
      };
      el.onwheel = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const node = nodeById(el.dataset.visualNode);
        if (!node) return;
        if (event.shiftKey) node.data.cameraYaw = Math.round(Number(node.data.cameraYaw ?? -18) + (event.deltaY > 0 ? 5 : -5));
        else node.data.actorYaw = Math.round(Number(node.data.actorYaw ?? node.data.yaw ?? 0) + (event.deltaY > 0 ? 5 : -5));
        syncSelectedVisualPreview();
        scheduleSave();
      };
    });
  }

  function refreshEdgesAndOverlay() {
    const svg = root.querySelector(".tf-fc-edges");
    if (svg) svg.innerHTML = edgeDefs() + state.canvas.edges.map(renderEdge).join("");
    const actions = root.querySelector(".tf-fc-selected-actions");
    const node = selectedNode();
    if (actions && node) {
      const vp = state.canvas.viewport;
      actions.style.left = `${vp.x + (node.x + NODE_W / 2) * vp.zoom - 96}px`;
      actions.style.top = `${Math.max(62, vp.y + node.y * vp.zoom - 44)}px`;
    }
  }

  function bindPanoramaDrag(shell) {
    shell.querySelectorAll("[data-pano]").forEach((el) => {
      el.onpointerdown = (event) => {
        event.stopPropagation();
        const node = nodeById(el.dataset.pano);
        if (!node) return;
        const startX = event.clientX;
        const startY = event.clientY;
        const baseYaw = Number(node.data.yaw || 50);
        const basePitch = Number(node.data.pitch || 50);
        el.setPointerCapture(event.pointerId);
        el.onpointermove = (moveEvent) => {
        const yaw = clamp(baseYaw + (moveEvent.clientX - startX) / 4, 0, 100);
        const pitch = isPano720(node.data) ? clamp(basePitch + (moveEvent.clientY - startY) / 6, 0, 100) : 50;
          node.data.yaw = Math.round(yaw);
          node.data.pitch = Math.round(pitch);
          const pano = resolvePanoCss(node.data);
          el.style.backgroundPosition = pano.position;
          el.style.backgroundSize = pano.size;
        };
        el.onpointerup = () => {
          el.onpointermove = null;
          el.onpointerup = null;
          scheduleSave();
        };
      };
    });
  }

  async function run(fn) {
    try {
      await fn();
    } catch (err) {
      setStatus(`操作失败：${err.message}`);
    }
  }

  document.addEventListener("keydown", (event) => {
    if (!state.open) return;
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (typing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      run(() => saveCanvas(true));
    }
    if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
    if (event.key === "Escape") {
      if (state.toolDialog?.type === "director3d") destroyDirectorStudio();
      if (state.toolDialog?.type === "panoImmersive") destroyImmersivePanoramaViewer();
      state.menu = null;
      state.connectingFrom = null;
      state.toolDialog = null;
      render();
    }
  });

  window.__toonflowFreeCanvas = { version: VERSION, open: openShell, state };
  renderLaunchers();
})();

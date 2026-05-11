/**
 * Standalone Three.js director stage for ToonFlow free canvas.
 * Adapted from the user's director's-3d-studio reference into a vanilla module.
 */
import * as THREE from "./vendor/three/build/three.module.js";
import { OrbitControls } from "./vendor/three/examples/jsm/controls/OrbitControls.js";

const CAMERA_PRESETS = [
  { name: "正面平视", position: [0, 1.7, 7], target: [0, 1.2, 0] },
  { name: "正面低机位", position: [0, 0.55, 6], target: [0, 1.55, 0] },
  { name: "正面俯拍", position: [0, 4.2, 6], target: [0, 0.7, 0] },
  { name: "左前45平视", position: [-5, 1.7, 5], target: [0, 1.2, 0] },
  { name: "右前45平视", position: [5, 1.7, 5], target: [0, 1.2, 0] },
  { name: "左侧90", position: [-7, 1.7, 0], target: [0, 1.2, 0] },
  { name: "右侧90", position: [7, 1.7, 0], target: [0, 1.2, 0] },
  { name: "背面平视", position: [0, 1.7, -7], target: [0, 1.2, 0] },
  { name: "顶视调度", position: [0, 9, 0.2], target: [0, 0, 0] },
  { name: "过肩左", position: [0.55, 1.55, 2.1], target: [-0.25, 1.55, 0] },
  { name: "过肩右", position: [-0.55, 1.55, 2.1], target: [0.25, 1.55, 0] },
];

const COLORS = ["#22d3ee", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#f97316", "#a855f7", "#ec4899", "#94a3b8", "#ffffff"];
const DEFAULT_ROWS = 2;
const DEFAULT_COLS = 2;
const DEFAULT_SPACING = 2;
const DEFAULT_FOCAL_LENGTH = 35;
const DEFAULT_CAMERA_POSITION = [5, 4, 8];
const DEFAULT_CAMERA_TARGET = [0, 1.1, 0];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function nodeDataToStudioState(data = {}) {
  const rows = clamp(Math.round(data.matrixRows || DEFAULT_ROWS), 1, 10);
  const cols = clamp(Math.round(data.matrixCols || DEFAULT_COLS), 1, 12);
  const spacing = clamp(data.spacing || data.matrixGapMeters || DEFAULT_SPACING, 0.7, 5);
  const saved = Array.isArray(data.directorActors) ? data.directorActors : [];
  const count = clamp(Math.round(data.actorCount || saved.length || rows * cols || 1), 1, 120);
  const actors = [];
  for (let i = 0; i < count; i += 1) {
    const savedActor = saved[i] || {};
    const r = Math.floor(i / cols);
    const c = i % cols;
    actors.push({
      id: savedActor.id || `actor-${Date.now()}-${i}`,
      label: savedActor.label || String(i + 1),
      position: savedActor.position || [
        (c - (cols - 1) / 2) * spacing,
        0,
        (r - (rows - 1) / 2) * spacing,
      ],
      rotation: savedActor.rotation || [0, Number(data.actorYaw || 0) * Math.PI / 180, 0],
      scale: Number(savedActor.scale || 1),
      heightScale: Number(savedActor.heightScale || 1),
      color: savedActor.color || COLORS[i % COLORS.length],
    });
  }
  return {
    rows,
    cols,
    spacing,
    showGrid: data.showGrid !== false,
    focalLength: Number(data.focalLength || DEFAULT_FOCAL_LENGTH),
    panoramaUrl: "",
    cameraPosition: data.cameraPosition || [...DEFAULT_CAMERA_POSITION],
    cameraTarget: data.cameraTarget || [...DEFAULT_CAMERA_TARGET],
    selectedId: data.selectedActorId || actors[0]?.id || null,
    actors,
  };
}

function studioStateToNodePatch(state, dataUrl) {
  return {
    directorActors: state.actors.map((actor) => ({
      id: actor.id,
      label: actor.label,
      position: actor.position.map((v) => Number(v.toFixed(3))),
      rotation: actor.rotation.map((v) => Number(v.toFixed(4))),
      scale: Number(actor.scale.toFixed(3)),
      heightScale: Number(actor.heightScale.toFixed(3)),
      color: actor.color,
    })),
    actorCount: state.actors.length,
    matrixRows: state.rows,
    matrixCols: state.cols,
    spacing: state.spacing,
    matrixGapMeters: state.spacing,
    focalLength: state.focalLength,
    showGrid: state.showGrid,
    selectedActorId: state.selectedId,
    cameraPosition: state.cameraPosition.map((v) => Number(v.toFixed(3))),
    cameraTarget: state.cameraTarget.map((v) => Number(v.toFixed(3))),
    panoramaUrl: state.panoramaUrl || "",
    directorPanoramaEnabled: false,
    directorPanoramaEnabledV2: !!state.panoramaUrl,
    ...(dataUrl ? { directorShotUrl: dataUrl } : {}),
  };
}

function makeButton(label, className = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `tf-d3-btn ${className}`.trim();
  btn.textContent = label;
  return btn;
}

function createNumberField(label, value, min, max, step, onChange, resetValue = null) {
  const wrap = document.createElement("label");
  wrap.className = "tf-d3-field";
  const text = document.createElement("span");
  text.textContent = label;
  const line = document.createElement("div");
  line.className = "tf-d3-field-line";
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("change", () => onChange(Number(input.value), input));
  line.append(input);
  if (resetValue !== null) {
    const reset = makeButton("重置", "mini");
    reset.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      input.value = String(resetValue);
      onChange(Number(resetValue), input);
    };
    line.append(reset);
  }
  wrap.append(text, line);
  return wrap;
}

function createRangeField(label, value, min, max, step, onChange, resetValue = null) {
  const wrap = document.createElement("label");
  wrap.className = "tf-d3-field range";
  const head = document.createElement("span");
  head.textContent = `${label}: ${value}`;
  const line = document.createElement("div");
  line.className = "tf-d3-field-line";
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("input", () => {
    head.textContent = `${label}: ${input.value}`;
    onChange(Number(input.value), input);
  });
  line.append(input);
  if (resetValue !== null) {
    const reset = makeButton("重置", "mini");
    reset.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      input.value = String(resetValue);
      head.textContent = `${label}: ${resetValue}`;
      onChange(Number(resetValue), input);
    };
    line.append(reset);
  }
  wrap.append(head, line);
  return wrap;
}

function buildMannequin(color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.04 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.72), roughness: 0.7 });
  const add = (mesh, position, rotation = [0, 0, 0]) => {
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 18), material), [0, 1.72, 0]);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.13, 16), material), [0, 1.56, 0]);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.54, 0.24), material), [0, 1.26, 0]);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.58, 16), material), [0, 1.47, 0], [0, 0, Math.PI / 2]);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.23), darkMaterial), [0, 0.94, 0]);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.55, 16), material), [-0.3, 1.17, 0], [0, 0, -0.14]);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.55, 16), material), [0.3, 1.17, 0], [0, 0, 0.14]);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), material), [-0.34, 0.88, 0]);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), material), [0.34, 0.88, 0]);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.9, 16), material), [-0.12, 0.49, 0], [0.05, 0, 0.03]);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.9, 16), material), [0.12, 0.49, 0], [0.05, 0, -0.03]);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.22), darkMaterial), [-0.12, 0.02, 0.07]);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.22), darkMaterial), [0.12, 0.02, 0.07]);
  return group;
}

class DirectorStudio {
  constructor(container, initialData, hooks = {}, options = {}) {
    this.container = container;
    this.hooks = hooks;
    this.options = options;
    this.state = nodeDataToStudioState(initialData);
    this.actorGroups = new Map();
    this.pointer = null;
    this.raycaster = new THREE.Raycaster();
    this.pointerVec = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmpPoint = new THREE.Vector3();
    this.renderFrame = this.renderFrame.bind(this);
    this.onContextLost = this.onContextLost.bind(this);
    this.onContextRestored = this.onContextRestored.bind(this);
    this.mount();
  }

  mount() {
    this.container.innerHTML = "";
    this.container.classList.add("tf-d3-root");
    this.layout = document.createElement("div");
    this.layout.className = this.options.compact ? "tf-d3-layout compact" : "tf-d3-layout";
    this.sidebar = document.createElement("aside");
    this.sidebar.className = "tf-d3-sidebar";
    this.viewport = document.createElement("main");
    this.viewport.className = "tf-d3-viewport";
    this.viewport.innerHTML = '<div class="tf-d3-white-backdrop"></div><div class="tf-d3-fallback"><div class="tf-d3-fallback-grid"></div><div class="tf-d3-fallback-note">WebGL不可用，已启用白底备用预览</div></div>';
    this.rightbar = document.createElement("aside");
    this.rightbar.className = "tf-d3-rightbar";
    if (this.options.compact) this.layout.append(this.viewport);
    else this.layout.append(this.sidebar, this.viewport, this.rightbar);
    this.container.append(this.layout);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#ffffff");
    this.camera = new THREE.PerspectiveCamera(this.fovFromFocal(this.state.focalLength), 1, 0.1, 2000);
    this.camera.position.set(...this.state.cameraPosition);
    this.camera.lookAt(new THREE.Vector3(...this.state.cameraTarget));
    this.viewport.style.background = "#ffffff";
    this.fallback = this.viewport.querySelector(".tf-d3-fallback");
    this.drawFallbackActors();
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        depth: true,
        stencil: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor("#ffffff", 1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.shadowMap.enabled = true;
      this.renderer.domElement.style.background = "#ffffff";
      this.renderer.domElement.addEventListener("webglcontextlost", this.onContextLost, false);
      this.renderer.domElement.addEventListener("webglcontextrestored", this.onContextRestored, false);
      this.viewport.append(this.renderer.domElement);
      this.fallback?.classList.remove("active");
    } catch (err) {
      this.webglFailed = true;
      this.fallback?.classList.add("active");
      this.setFallbackNote(`WebGL不可用：${err.message || err}`);
    }

    if (this.renderer) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.target.set(...this.state.cameraTarget);
      this.controls.addEventListener("change", () => this.persistCamera());
    }

    this.scene.add(new THREE.AmbientLight("#ffffff", 1.5));
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#94a3b8", 1.2));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(6, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    this.scene.add(key);
    const spot = new THREE.SpotLight("#ffffff", 2, 80, Math.PI / 5, 0.35, 1.2);
    spot.position.set(-5, 9, 6);
    spot.castShadow = true;
    this.scene.add(spot);
    const fill = new THREE.PointLight("#93c5fd", 1);
    fill.position.set(-6, 4, -6);
    this.scene.add(fill);

    this.grid = new THREE.GridHelper(40, 40, "#94a3b8", "#dbe4ef");
    this.scene.add(this.grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floor = floor;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 0.04, 96),
      new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.86, metalness: 0.02 })
    );
    base.position.y = 0.012;
    base.receiveShadow = true;
    this.scene.add(base);
    this.base = base;

    this.cameraHelper = this.createCameraHelper();
    this.cameraHelper.visible = false;
    this.scene.add(this.cameraHelper);
    this.state.panoramaUrl = "";
    this.syncActors();
    if (!this.options.compact) this.renderControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.renderer?.domElement.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    window.addEventListener("pointermove", this.onPointerMove = (event) => this.handlePointerMove(event));
    window.addEventListener("pointerup", this.onPointerUp = () => this.handlePointerUp());
    this.resize();
    setTimeout(() => this.resize(), 0);
    setTimeout(() => this.resize(), 120);
    if (this.renderer) this.renderer.setAnimationLoop(this.renderFrame);
  }

  onContextLost(event) {
    event.preventDefault();
    this.webglFailed = true;
    this.fallback?.classList.add("active");
    this.setFallbackNote("WebGL上下文丢失，正在等待浏览器恢复");
  }

  onContextRestored() {
    this.webglFailed = false;
    this.fallback?.classList.remove("active");
    this.resize();
    this.renderFrame();
  }

  setFallbackNote(text) {
    const note = this.fallback?.querySelector(".tf-d3-fallback-note");
    if (note) note.textContent = text;
  }

  drawFallbackActors() {
    if (!this.fallback) return;
    this.fallback.querySelectorAll(".tf-d3-fallback-person").forEach((el) => el.remove());
    const count = Math.max(1, this.state.actors.length);
    this.state.actors.forEach((actor, index) => {
      const col = index % Math.max(1, this.state.cols);
      const row = Math.floor(index / Math.max(1, this.state.cols));
      const x = 50 + (col - (this.state.cols - 1) / 2) * 14;
      const y = 58 + (row - (this.state.rows - 1) / 2) * 11;
      const el = document.createElement("div");
      el.className = "tf-d3-fallback-person";
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
      el.style.setProperty("--c", actor.color || COLORS[index % COLORS.length]);
      el.innerHTML = '<span class="head"></span><span class="body"></span><span class="arm-l"></span><span class="arm-r"></span><span class="leg-l"></span><span class="leg-r"></span>';
      this.fallback.append(el);
    });
    this.setFallbackNote(`备用预览：${count}人，WebGL不可用时显示`);
  }

  createCameraHelper() {
    const group = new THREE.Group();
    group.name = "cameraRig";
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.28), new THREE.MeshStandardMaterial({ color: "#2563eb" }));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.26, 20), new THREE.MeshStandardMaterial({ color: "#111827" }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.28;
    const cone = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.8, -0.45, -1.4),
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.8, -0.45, -1.4),
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.8, 0.45, -1.4),
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.8, 0.45, -1.4),
      ]),
      new THREE.LineBasicMaterial({ color: "#2563eb" })
    );
    group.add(body, lens, cone);
    return group;
  }

  fovFromFocal(focal) {
    return 2 * Math.atan(18 / clamp(focal, 12, 120)) * (180 / Math.PI);
  }

  resize() {
    if (!this.renderer) return;
    const rect = this.viewport.getBoundingClientRect();
    const parentRect = this.viewport.parentElement?.getBoundingClientRect() || {};
    const compactFallbackHeight = this.options.compact ? 190 : 540;
    const width = Math.max(
      320,
      Math.round(rect.width || this.viewport.clientWidth || parentRect.width || Math.min(window.innerWidth - 80, 1120))
    );
    const height = Math.max(
      190,
      Math.round(rect.height || this.viewport.clientHeight || parentRect.height || compactFallbackHeight)
    );
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  renderFrame() {
    if (!this.renderer || this.webglFailed) return;
    this.controls?.update();
    this.renderer.setClearColor("#ffffff", 1);
    if (!this.state.panoramaUrl) this.scene.background = new THREE.Color("#ffffff");
    this.grid.visible = this.state.showGrid && !this.state.panoramaUrl;
    this.floor.visible = !this.state.panoramaUrl;
    if (this.base) this.base.visible = !this.state.panoramaUrl;
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
  }

  persistCamera() {
    this.state.cameraPosition = this.camera.position.toArray();
    this.state.cameraTarget = this.controls.target.toArray();
  }

  syncActors() {
    for (const group of this.actorGroups.values()) this.scene.remove(group);
    this.actorGroups.clear();
    for (const actor of this.state.actors) {
      const group = buildMannequin(actor.color);
      group.userData.actorId = actor.id;
      group.position.set(...actor.position);
      group.rotation.set(...actor.rotation);
      group.scale.set(actor.scale, actor.scale * actor.heightScale, actor.scale);
      this.actorGroups.set(actor.id, group);
      this.scene.add(group);
    }
    this.highlightSelected();
    this.drawFallbackActors();
  }

  highlightSelected() {
    for (const [id, group] of this.actorGroups) {
      const selected = id === this.state.selectedId;
      group.traverse((obj) => {
        if (obj.isMesh && obj.material?.emissive) obj.material.emissive.set(selected ? "#1d4ed8" : "#000000");
      });
    }
  }

  selectedActor() {
    return this.state.actors.find((actor) => actor.id === this.state.selectedId) || null;
  }

  rebuildMatrix() {
    const count = clamp(this.state.rows * this.state.cols, 1, 120);
    this.state.actors = [];
    for (let i = 0; i < count; i += 1) {
      const r = Math.floor(i / this.state.cols);
      const c = i % this.state.cols;
      this.state.actors.push({
        id: `actor-${Date.now()}-${i}`,
        label: String(i + 1),
        position: [(c - (this.state.cols - 1) / 2) * this.state.spacing, 0, (r - (this.state.rows - 1) / 2) * this.state.spacing],
        rotation: [0, 0, 0],
        scale: 1,
        heightScale: 1,
        color: COLORS[i % COLORS.length],
      });
    }
    this.state.selectedId = this.state.actors[0]?.id || null;
    this.syncActors();
    this.renderControls();
    this.emitChange();
  }

  resetMatrix() {
    this.state.rows = DEFAULT_ROWS;
    this.state.cols = DEFAULT_COLS;
    this.state.spacing = DEFAULT_SPACING;
    this.rebuildMatrix();
  }

  resetSelectedActor() {
    const actor = this.selectedActor();
    if (!actor) return;
    actor.rotation = [0, 0, 0];
    actor.scale = 1;
    actor.heightScale = 1;
    actor.color = COLORS[0];
    const group = this.actorGroups.get(actor.id);
    if (group) {
      group.rotation.set(...actor.rotation);
      group.scale.set(actor.scale, actor.scale * actor.heightScale, actor.scale);
    }
    this.syncActors();
    this.renderControls();
    this.emitChange();
  }

  resetCamera() {
    this.state.focalLength = DEFAULT_FOCAL_LENGTH;
    this.camera.fov = this.fovFromFocal(DEFAULT_FOCAL_LENGTH);
    this.camera.position.set(...DEFAULT_CAMERA_POSITION);
    if (this.controls) {
      this.controls.target.set(...DEFAULT_CAMERA_TARGET);
      this.controls.update();
    } else {
      this.camera.lookAt(new THREE.Vector3(...DEFAULT_CAMERA_TARGET));
    }
    this.camera.updateProjectionMatrix();
    this.persistCamera();
    this.renderControls();
    this.emitChange();
  }

  resetAll() {
    this.state.panoramaUrl = "";
    this.scene.background = new THREE.Color("#ffffff");
    this.scene.environment = null;
    this.resetMatrix();
    this.resetCamera();
  }

  addActor() {
    const actor = {
      id: `actor-${Date.now()}`,
      label: String(this.state.actors.length + 1),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
      heightScale: 1,
      color: COLORS[this.state.actors.length % COLORS.length],
    };
    this.state.actors.push(actor);
    this.state.selectedId = actor.id;
    this.syncActors();
    this.renderControls();
    this.emitChange();
  }

  deleteSelected() {
    if (!this.state.selectedId) return;
    this.state.actors = this.state.actors.filter((actor) => actor.id !== this.state.selectedId);
    this.state.selectedId = this.state.actors[0]?.id || null;
    this.syncActors();
    this.renderControls();
    this.emitChange();
  }

  setSelectedActorPatch(patch) {
    const actor = this.selectedActor();
    if (!actor) return;
    Object.assign(actor, patch);
    const group = this.actorGroups.get(actor.id);
    if (group) {
      group.position.set(...actor.position);
      group.rotation.set(...actor.rotation);
      group.scale.set(actor.scale, actor.scale * actor.heightScale, actor.scale);
      if (patch.color) this.syncActors();
    }
    this.emitChange();
  }

  renderControls() {
    if (this.options.compact) return;
    this.sidebar.innerHTML = "";
    this.rightbar.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "3D导演台 v2白底";
    this.sidebar.append(title);
    const actions = document.createElement("div");
    actions.className = "tf-d3-actions";
    const addActor = makeButton("添加人物", "primary");
    addActor.onclick = () => this.addActor();
    const delActor = makeButton("删除选中");
    delActor.onclick = () => this.deleteSelected();
    actions.append(addActor, delActor);
    this.sidebar.append(actions);
    this.sidebar.append(
      createNumberField("矩阵行数", this.state.rows, 1, 10, 1, (v) => { this.state.rows = clamp(Math.round(v), 1, 10); this.rebuildMatrix(); }, DEFAULT_ROWS),
      createNumberField("矩阵列数", this.state.cols, 1, 12, 1, (v) => { this.state.cols = clamp(Math.round(v), 1, 12); this.rebuildMatrix(); }, DEFAULT_COLS),
      createRangeField("人物间距", this.state.spacing, 0.7, 5, 0.1, (v) => { this.state.spacing = v; this.rebuildMatrix(); }, DEFAULT_SPACING)
    );
    const matrixReset = makeButton("重置矩阵");
    matrixReset.onclick = () => this.resetMatrix();
    this.sidebar.append(matrixReset);

    const panoLabel = document.createElement("label");
    panoLabel.className = "tf-d3-upload";
    panoLabel.textContent = this.state.panoramaUrl ? "更换全景图" : "上传360/720全景图";
    const panoInput = document.createElement("input");
    panoInput.type = "file";
    panoInput.accept = "image/*";
    panoInput.onchange = () => panoInput.files?.[0] && this.loadPanoramaFile(panoInput.files[0]);
    panoLabel.append(panoInput);
    const clearPano = makeButton("清除全景");
    clearPano.onclick = () => this.clearPanorama();
    const resetAll = makeButton("重置全部");
    resetAll.onclick = () => this.resetAll();
    this.sidebar.append(panoLabel, clearPano, resetAll);

    const actor = this.selectedActor();
    const rTitle = document.createElement("h3");
    rTitle.textContent = actor ? `人物 ${actor.label}` : "未选择人物";
    this.rightbar.append(rTitle);
    if (actor) {
      this.rightbar.append(
        createRangeField("水平旋转", Math.round(actor.rotation[1] * 180 / Math.PI), -180, 180, 1, (v) => this.setSelectedActorPatch({ rotation: [actor.rotation[0], v * Math.PI / 180, actor.rotation[2]] }), 0),
        createRangeField("俯仰", Math.round(actor.rotation[0] * 180 / Math.PI), -90, 90, 1, (v) => this.setSelectedActorPatch({ rotation: [v * Math.PI / 180, actor.rotation[1], actor.rotation[2]] }), 0),
        createRangeField("整体大小", actor.scale, 0.2, 3, 0.05, (v) => this.setSelectedActorPatch({ scale: v }), 1),
        createRangeField("身高比例", actor.heightScale, 0.5, 1.8, 0.02, (v) => this.setSelectedActorPatch({ heightScale: v }), 1)
      );
      const resetActor = makeButton("重置人物");
      resetActor.onclick = () => this.resetSelectedActor();
      const swatches = document.createElement("div");
      swatches.className = "tf-d3-swatches";
      COLORS.forEach((color) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.style.backgroundColor = color;
        swatch.className = actor.color === color ? "active" : "";
        swatch.onclick = () => this.setSelectedActorPatch({ color });
        swatches.append(swatch);
      });
      this.rightbar.append(resetActor, swatches);
    }

    const lensTitle = document.createElement("h3");
    lensTitle.textContent = "机位镜头";
    this.rightbar.append(lensTitle);
    this.rightbar.append(createRangeField("焦距mm", this.state.focalLength, 12, 120, 1, (v) => {
      this.state.focalLength = v;
      this.camera.fov = this.fovFromFocal(v);
      this.camera.updateProjectionMatrix();
      this.emitChange();
    }, DEFAULT_FOCAL_LENGTH));
    const resetCamera = makeButton("重置镜头/机位");
    resetCamera.onclick = () => this.resetCamera();
    this.rightbar.append(resetCamera);
    const presets = document.createElement("div");
    presets.className = "tf-d3-presets";
    CAMERA_PRESETS.forEach((preset) => {
      const btn = makeButton(preset.name);
      btn.onclick = () => this.applyPreset(preset);
      presets.append(btn);
    });
    this.rightbar.append(presets);
  }

  applyPreset(preset) {
    const actor = this.selectedActor();
    const offset = actor ? new THREE.Vector3(...actor.position) : new THREE.Vector3();
    const position = new THREE.Vector3(...preset.position).add(offset);
    const target = actor ? new THREE.Vector3(actor.position[0], actor.position[1] + 1.2, actor.position[2]) : new THREE.Vector3(...preset.target);
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.controls.update();
    this.persistCamera();
    this.emitChange();
  }

  loadPanoramaFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      this.setPanorama(String(reader.result || ""));
      this.emitChange();
    };
    reader.readAsDataURL(file);
  }

  setPanorama(url) {
    this.state.panoramaUrl = url;
    new THREE.TextureLoader().load(url, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = texture;
      this.scene.environment = texture;
    }, undefined, () => {
      this.state.panoramaUrl = "";
      this.scene.background = new THREE.Color("#ffffff");
      this.scene.environment = null;
    });
  }

  clearPanorama() {
    this.state.panoramaUrl = "";
    this.scene.background = new THREE.Color("#ffffff");
    this.scene.environment = null;
    this.emitChange();
  }

  onPointerDown(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerVec, this.camera);
    const hits = this.raycaster.intersectObjects([...this.actorGroups.values()], true);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj && !obj.userData.actorId) obj = obj.parent;
    if (!obj) return;
    event.preventDefault();
    this.state.selectedId = obj.userData.actorId;
    this.highlightSelected();
    this.renderControls();
    if (event.shiftKey || event.button === 0) {
      this.controls.enabled = false;
      this.pointer = { actorId: obj.userData.actorId };
    }
  }

  handlePointerMove(event) {
    if (!this.pointer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerVec, this.camera);
    if (this.raycaster.ray.intersectPlane(this.plane, this.tmpPoint)) {
      const actor = this.state.actors.find((item) => item.id === this.pointer.actorId);
      if (actor) {
        actor.position = [this.tmpPoint.x, 0, this.tmpPoint.z];
        const group = this.actorGroups.get(actor.id);
        if (group) group.position.set(...actor.position);
        this.emitChange(false);
      }
    }
  }

  handlePointerUp() {
    if (!this.pointer) return;
    this.pointer = null;
    this.controls.enabled = true;
    this.emitChange();
  }

  captureDataUrl() {
    if (!this.renderer || this.fallback?.classList.contains("active")) {
      return this.captureFallbackDataUrl();
    }
    this.persistCamera();
    this.renderFrame();
    return this.renderer.domElement.toDataURL("image/png");
  }

  captureFallbackDataUrl() {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#dbe4ef";
    for (let x = 90; x < 870; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 430);
      ctx.lineTo(480 + (x - 480) * 0.36, 230);
      ctx.stroke();
    }
    for (let y = 250; y < 450; y += 34) {
      ctx.beginPath();
      ctx.moveTo(120, y);
      ctx.lineTo(840, y);
      ctx.stroke();
    }
    for (const [index, actor] of this.state.actors.entries()) {
      const col = index % Math.max(1, this.state.cols);
      const row = Math.floor(index / Math.max(1, this.state.cols));
      const x = 480 + (col - (this.state.cols - 1) / 2) * 120;
      const y = 300 + (row - (this.state.rows - 1) / 2) * 80;
      ctx.fillStyle = actor.color || COLORS[index % COLORS.length];
      ctx.beginPath();
      ctx.arc(x, y - 58, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 20, y - 34, 40, 58);
      ctx.fillRect(x - 34, y - 22, 10, 48);
      ctx.fillRect(x + 24, y - 22, 10, 48);
      ctx.fillRect(x - 16, y + 24, 11, 52);
      ctx.fillRect(x + 5, y + 24, 11, 52);
    }
    return canvas.toDataURL("image/png");
  }

  getPatch(dataUrl) {
    this.persistCamera();
    return studioStateToNodePatch(this.state, dataUrl);
  }

  emitChange(save = true) {
    this.persistCamera();
    if (typeof this.hooks.onChange === "function") this.hooks.onChange(this.getPatch(), save);
  }

  destroy() {
    if (this.renderer) this.renderer.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.controls?.dispose();
    this.renderer?.domElement.removeEventListener("webglcontextlost", this.onContextLost, false);
    this.renderer?.domElement.removeEventListener("webglcontextrestored", this.onContextRestored, false);
    this.renderer?.dispose();
    this.container.innerHTML = "";
  }
}

window.ToonflowDirector3DStudio = {
  create(container, data, hooks, options) {
    return new DirectorStudio(container, deepClone(data), hooks, options);
  },
};

import * as THREE from "./vendor/three/build/three.module.js";
import { OrbitControls } from "./vendor/three/examples/jsm/controls/OrbitControls.js";

const DEFAULT_FOV = 75;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function imageUrlFromData(data = {}) {
  return data.panoramaUrl || data.imageUrl || data.outputUrl || data.src || "";
}

function legacyYawToDeg(data = {}) {
  if (Number.isFinite(Number(data.panoYawDeg))) return Number(data.panoYawDeg);
  return clamp(data.yaw ?? 50, 0, 100) / 100 * 360;
}

function legacyPitchToDeg(data = {}) {
  if (Number.isFinite(Number(data.panoPitchDeg))) return Number(data.panoPitchDeg);
  return (50 - clamp(data.pitch ?? 50, 0, 100)) / 50 * 80;
}

function directionFromAngles(yawDeg, pitchDeg) {
  const yaw = THREE.MathUtils.degToRad(Number(yawDeg) || 0);
  const pitch = THREE.MathUtils.degToRad(clamp(pitchDeg, -89, 89));
  const cosPitch = Math.cos(pitch);
  return new THREE.Vector3(
    Math.sin(yaw) * cosPitch,
    Math.sin(pitch),
    -Math.cos(yaw) * cosPitch
  ).normalize();
}

function anglesFromCamera(camera) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const yaw = THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z));
  const pitch = THREE.MathUtils.radToDeg(Math.asin(clamp(dir.y, -1, 1)));
  return {
    yaw: (yaw + 360) % 360,
    pitch: clamp(pitch, -89, 89),
  };
}

function applyCameraAngles(camera, controls, yawDeg, pitchDeg) {
  const dir = directionFromAngles(yawDeg, pitchDeg);
  camera.position.copy(dir.clone().multiplyScalar(-0.1));
  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  controls.update();
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      resolve(texture);
    }, undefined, reject);
  });
}

class PanoramaViewer {
  constructor(container, data, hooks = {}, options = {}) {
    this.container = container;
    this.data = { ...(data || {}) };
    this.hooks = hooks;
    this.options = options;
    this.fov = clamp(this.data.panoFov || DEFAULT_FOV, 30, 110);
    this.yaw = legacyYawToDeg(this.data);
    this.pitch = legacyPitchToDeg(this.data);
    this.renderFrame = this.renderFrame.bind(this);
    this.mount();
  }

  mount() {
    this.container.innerHTML = "";
    this.container.classList.add("tf-vr-root");
    this.container.innerHTML = `
      <canvas class="tf-vr-canvas"></canvas>
      <div class="tf-vr-loading">正在加载全景...</div>
      <div class="tf-vr-crosshair"><span></span><b></b><i></i></div>
      <div class="tf-vr-hud" style="${this.options.immersive ? "display:none" : ""}">
        <span>FOV ${Math.round(this.fov)}°</span>
        <span>VR READY</span>
      </div>
      ${this.options.compact ? "" : `<div class="tf-vr-menu">
        <button type="button" data-vr-action="capture">当前视角截图</button>
        <button type="button" data-vr-action="grid4">四宫格</button>
        <button type="button" data-vr-action="grid9">九宫格</button>
        <button type="button" data-vr-action="reset">重置视角</button>
      </div>`}
    `;
    this.canvas = this.container.querySelector(".tf-vr-canvas");
    this.loading = this.container.querySelector(".tf-vr-loading");
    this.hud = this.container.querySelector(".tf-vr-hud span");
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor("#000000", 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = -0.5;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.addEventListener("change", () => this.emitChange(false));
    this.controls.addEventListener("end", () => this.emitChange(true));
    applyCameraAngles(this.camera, this.controls, this.yaw, this.pitch);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.container.addEventListener("click", (event) => event.stopPropagation());
    this.container.addEventListener("dblclick", (event) => event.stopPropagation());
    this.container.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.canvas.addEventListener("wheel", (event) => this.handleWheel(event), { passive: false });
    this.canvas.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.container.querySelectorAll("[data-vr-action]").forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        const action = button.dataset.vrAction;
        if (action === "capture") this.hooks.onCapture?.();
        if (action === "grid4") this.hooks.onGrid?.(4);
        if (action === "grid9") this.hooks.onGrid?.(9);
        if (action === "reset") this.resetView();
      };
    });
    this.resize();
    this.load(imageUrlFromData(this.data));
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  async load(url) {
    if (!url) {
      this.loading.textContent = "请上传全景图";
      return;
    }
    this.loading.style.display = "grid";
    try {
      const texture = await loadTexture(url);
      if (this.sphere) {
        this.scene.remove(this.sphere);
        this.sphere.geometry.dispose();
        this.sphere.material.map?.dispose();
        this.sphere.material.dispose();
      }
      const geometry = new THREE.SphereGeometry(500, 80, 48);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ map: texture });
      this.sphere = new THREE.Mesh(geometry, material);
      this.scene.add(this.sphere);
      this.loading.style.display = "none";
    } catch (err) {
      this.loading.textContent = `全景图加载失败：${err?.message || err}`;
    }
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(260, Math.round(rect.width || this.container.clientWidth || 360));
    const height = Math.max(150, Math.round(rect.height || this.container.clientHeight || 190));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  handleWheel(event) {
    event.preventDefault();
    event.stopPropagation();
    this.fov = clamp(this.fov + event.deltaY * 0.05, 30, 110);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.updateHud();
    this.emitChange();
  }

  updateHud() {
    if (this.hud) this.hud.textContent = `FOV ${Math.round(this.fov)}°`;
  }

  emitChange(save = true) {
    const angles = anglesFromCamera(this.camera);
    this.yaw = angles.yaw;
    this.pitch = angles.pitch;
    this.hooks.onChange?.({
      panoYawDeg: Number(this.yaw.toFixed(2)),
      panoPitchDeg: Number(this.pitch.toFixed(2)),
      panoFov: Number(this.fov.toFixed(2)),
      yaw: Math.round((this.yaw / 360) * 100),
      pitch: Math.round(50 - (this.pitch / 80) * 50),
    }, save);
  }

  renderFrame() {
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  }

  resetView() {
    this.fov = DEFAULT_FOV;
    this.camera.fov = this.fov;
    applyCameraAngles(this.camera, this.controls, 0, 0);
    this.camera.updateProjectionMatrix();
    this.updateHud();
    this.emitChange();
  }

  captureDataUrl(width = 960, height = 540) {
    const currentSize = new THREE.Vector2();
    this.renderer.getSize(currentSize);
    const currentPixelRatio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL("image/png", 1);
    this.renderer.setPixelRatio(currentPixelRatio);
    this.renderer.setSize(currentSize.x, currentSize.y, false);
    this.resize();
    return dataUrl;
  }

  destroy() {
    this.renderer?.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    if (this.sphere) {
      this.sphere.geometry.dispose();
      this.sphere.material.map?.dispose();
      this.sphere.material.dispose();
    }
    this.renderer?.dispose();
    this.container.innerHTML = "";
  }
}

async function capturePanoramaUrl(url, options = {}) {
  const width = options.width || 960;
  const height = options.height || 540;
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(clamp(options.fov || DEFAULT_FOV, 30, 110), width / height, 0.1, 1000);
  const texture = await loadTexture(url);
  const geometry = new THREE.SphereGeometry(500, 80, 48);
  geometry.scale(-1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);
  const controls = { target: new THREE.Vector3(), update() {} };
  applyCameraAngles(camera, controls, options.yaw || 0, options.pitch || 0);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png", 1);
  geometry.dispose();
  material.map?.dispose();
  material.dispose();
  renderer.dispose();
  return dataUrl;
}

window.ToonflowPanoramaViewer = {
  create(container, data, hooks, options) {
    return new PanoramaViewer(container, data, hooks, options);
  },
  capturePanoramaUrl,
  legacyYawToDeg,
  legacyPitchToDeg,
};

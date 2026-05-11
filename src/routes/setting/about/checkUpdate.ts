import express from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { buildCustomUpdateDisabledPayload, getConfiguredCustomUpdateUrl } from "@/lib/customUpdateSource";

const router = express.Router();

declare const __APP_VERSION__: string | undefined;

const APP_VERSION: string = (() => {
  if (typeof __APP_VERSION__ !== "undefined") {
    return __APP_VERSION__;
  }
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return pkg.version;
})();

export default router.post(
  "/",
  validateFields({
    source: z.enum(["toonflow", "github", "gitee", "atomgit"]),
    url: z.url().nullable().optional(),
  }),
  async (req, res) => {
    const { source, url } = req.body;
    const updateUrl = getConfiguredCustomUpdateUrl(url);

    if (!updateUrl) {
      return res.status(200).send(success(buildCustomUpdateDisabledPayload(APP_VERSION)));
    }

    let versionInfo: any;
    try {
      versionInfo = await fetch(updateUrl).then((response) => response.json());
    } catch {
      return res.status(400).send(error("自定义更新源不可用，请检查 TOONFLOW_CUSTOM_UPDATE_URL 配置"));
    }

    if (!versionInfo) {
      return res.status(400).send(error("无法获取版本信息"));
    }

    const { version: latestVersion, time, data } = versionInfo;
    const sourceData = data?.[source];
    if (!sourceData) {
      return res.status(400).send(error("自定义更新源中缺少当前下载源配置"));
    }

    const platformType: Record<string, string> = {
      win32: "windows",
      darwin: "macos",
      linux: "linux",
    };

    const zipItem = sourceData.find((item: any) => item.type === "zip");
    const installerItem = sourceData.find((item: any) => item.type === platformType[process.platform]);

    const latestVersionList = latestVersion.split(".").map(Number);
    const currentVersionList = APP_VERSION.split(".").map(Number);

    if (latestVersionList[0] > currentVersionList[0]) {
      if (!installerItem) {
        return res.status(400).send(error("自定义更新源缺少当前系统所需的安装包"));
      }
      return res.status(200).send(
        success({
          needUpdate: true,
          latestVersion,
          reinstall: true,
          time,
          url: installerItem.url,
          version: latestVersion,
          customSourceConfigured: true,
        }),
      );
    }

    if (latestVersionList[1] > currentVersionList[1]) {
      if (!installerItem) {
        return res.status(400).send(error("自定义更新源缺少当前系统所需的安装包"));
      }
      return res.status(200).send(
        success({
          needUpdate: true,
          latestVersion,
          reinstall: true,
          time,
          url: installerItem.url,
          version: latestVersion,
          customSourceConfigured: true,
        }),
      );
    }

    if (latestVersionList[2] > currentVersionList[2]) {
      if (!zipItem) {
        return res.status(400).send(error("自定义更新源缺少增量更新包"));
      }
      return res.status(200).send(
        success({
          needUpdate: true,
          latestVersion,
          reinstall: false,
          time,
          url: zipItem.url,
          version: latestVersion,
          customSourceConfigured: true,
        }),
      );
    }

    return res.status(200).send(
      success({
        needUpdate: false,
        latestVersion,
        reinstall: false,
        time,
        version: latestVersion,
        customSourceConfigured: true,
      }),
    );
  },
);

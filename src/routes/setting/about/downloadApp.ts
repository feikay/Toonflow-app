import express from "express";
import fs from "fs";
import z from "zod";
import axios from "axios";
import compressing from "compressing";
import u from "@/utils";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { isAllowedCustomDownloadUrl } from "@/lib/customUpdateSource";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    url: z.url(),
    reinstall: z.boolean(),
    version: z.string(),
  }),
  async (req, res) => {
    const { reinstall, url, version } = req.body;

    if (!isAllowedCustomDownloadUrl(url)) {
      return res.status(400).send(error("未配置自定义更新源，或下载地址不在允许范围内"));
    }

    if (reinstall) {
      return res.status(200).send(success("请在浏览器中手动下载安装我们自己的最新版本"));
    }

    const rootDir = u.getPath(["temp"]);
    fs.mkdirSync(rootDir, { recursive: true });
    const zip = await axios.get(url, { responseType: "arraybuffer" }).then((response) => response.data);
    fs.writeFileSync(`${rootDir}/latest.zip`, zip);
    await compressing.zip.uncompress(`${rootDir}/latest.zip`, rootDir);
    const dataDir = u.getPath();
    fs.cpSync(rootDir, dataDir, { recursive: true, force: true });
    fs.rmSync(rootDir, { recursive: true, force: true });
    return res.status(200).send(success(`更新 ${version} 成功，3 秒后重启`));
  },
);

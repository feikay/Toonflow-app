# 即梦 CLI 接入 Toonflow（本地桥接版）

本文档用于把即梦账号能力接入 `D:\work\Toonflow`，实现在 Toonflow 流程内调用即梦生视频。

## 1. 前置准备

1. 下载 dreamina 可执行文件（Windows）到：
   - `D:\work\dreamina.exe`
2. 登录即梦账号（只需一次）：

```powershell
D:\work\dreamina.exe login --headless
# 浏览器完成授权后，使用返回的 device_code 轮询
D:\work\dreamina.exe login checklogin --device_code=<device_code> --poll=60
D:\work\dreamina.exe user_credit
```

## 2. 启动桥接服务

在 Toonflow 根目录执行：

```powershell
cd D:\work\Toonflow
node .\scripts\jimeng-bridge.mjs
```

健康检查：

```powershell
curl http://127.0.0.1:18765/health
```

## 3. 在 Toonflow 中添加供应商

已提供供应商模板文件：

- `D:\work\Toonflow\data\vendor\jimengcli.ts`

在 Toonflow 设置中心 -> 供应商配置中新增供应商，粘贴该文件内容并保存。  
再将项目的视频模型绑定到 `jimengcli` 下对应模型（如 `seedance2.0fast`）。

## 4. 运行机制说明

- Toonflow 调用 `jimengcli` 供应商的 `videoRequest`
- 供应商向 `http://127.0.0.1:18765/v1/video/generate` 发请求
- 桥接服务执行 `dreamina` 命令：
  - 无参考图：`text2video`
  - 单参考图：`image2video`
  - 多参考图：`multiframe2video`
- 任务完成后桥接服务返回视频 base64，Toonflow 自动入库到素材路径

## 5. 直接调试（不走 Toonflow）

```powershell
curl -X POST "http://127.0.0.1:18765/v1/video/generate" `
  -H "Content-Type: application/json" `
  -d "{\"prompt\":\"cinematic close-up\",\"images\":[],\"duration\":5,\"ratio\":\"9:16\",\"video_resolution\":\"720p\",\"model_version\":\"seedance2.0fast\"}"
```

## 6. 常见问题

1. `未检测到有效登录态`  
   - 重新执行 `dreamina login` 或 `dreamina relogin`

2. `AigcComplianceConfirmationRequired`  
   - 先到即梦 Web 端完成一次授权确认，再重试 CLI

3. 生成慢/超时  
   - 先用 `seedance2.0fast`  
   - 适当降低并发，减少一次任务的参考图数量


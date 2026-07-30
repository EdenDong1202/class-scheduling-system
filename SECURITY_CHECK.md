# 发布前安全检查报告

> 检查时间：2026-07-30
> 检查范围：`teable-scheduling-system/` 全部文件
> 执行工具：publish-security-check Skill（`scan_secrets.py`）

## 1. API Key / Token 检查

- **结果**：未发现任何硬编码的真实 API Key、Token 或 Bearer 凭据。
- 说明：所有应用均通过 `process.env.TEABLE_APP_TOKEN` / `process.env.TEABLE_API_URL` 读取环境变量；`schema/structure.json` 中的 `token` 字段已标记为 `<REDACTED>`。
- 已配置：`.env.example` 列出所需环境变量，`.gitignore` 已排除 `.env`。

## 2. 真实可访问地址 / 基础设施标识脱敏

| 类型 | 原真实值 | 脱敏后 | 位置 |
|------|----------|--------|------|
| 排课看板 iframe 地址 | `https://appwnlhqc9sifcf8gkd.yach-teable-v0.app/...` | **保留真实地址**（已确认=独立假数据公开演示视图，无敏感信息） | `docs/index.html` |
| 班课管理 iframe 地址 | `https://apphkqncb1jgvxruhw8.yach-teable-v0.app/` | **保留真实地址**（同上） | `docs/index.html` |
| Vercel 部署地址 | `https://sb-7kdmjb2wrs2k.vercel.run` | `https://your-deployed-app.example.com` | `apps/paike-kanban/components/app-switcher.tsx` |
| Teable App ID × 3 | `app8wEQw7q2yUxlT7Ia` 等 | `YOUR_TEABLE_APP_ID_*` | `schema/structure.json`、`apps/.../components/app-switcher.tsx` |
| Teable Base ID | `bseOSQ2egnWDSErG5w2` | `YOUR_TEABLE_BASE_ID` | 代码、schema、文档 |
| Teable Table ID | `tblvLCLa4c8jxN0U2cw` | `YOUR_TEABLE_TABLE_ID` | 代码、schema、文档 |

- 代码中原本硬编码的 `BASE_ID` / `TABLE_ID` 已改为读取 `process.env`；未设置环境变量时使用 `YOUR_TEABLE_*` 占位符，运行时会提示配置。

> **关于两个演示 iframe 地址的特别说明（2026-07-30 确认）**：仓库所有者确认这两个 Teable 应用是**独立的、仅含假数据的公开演示视图**（页面明确标注"演示数据不会保存到数据库"；数据为"2026暑假测试""模拟课程"等占位内容，无真实姓名/邮箱/电话）。经 WebFetch 实测，页面与 URL 中**不含任何 API Key、Token 或凭证**。因此决定在公开仓库中**保留真实地址**，使 GitHub Pages 上的展示页可直接打开活演示。代码中其余基础设施标识（App ID / Base ID / Table ID / Vercel 地址）仍保持脱敏占位，因它们指向真实应用资产。

## 3. GitGuardian 检测

- 当前环境未安装/登录 GitGuardian CLI（`ggshield`）。
- 建议：在 CI 中接入 `ggshield secret scan repo .`（需提供 `GITGUARDIAN_API_KEY`）。
- 本地已通过 `scan_secrets.py` 做初筛，未发现真实密钥值。

## 4. API Key 限额与轮换建议

- 当前仓库不持有任何真实 Key，因此无本地限额设置。
- 复现时请遵循：
  1. 在 Teable 后台创建**仅具有必要权限**的 App Token；
  2. 设置用量上限 / 访问 IP 白名单（如 Teable 支持）；
  3. 每 90 天轮换一次 Token；
  4. 离职/合作结束时立即吊销旧 Token。

## 5. 扫描脚本误报说明

`scan_secrets.py` 报出 42 处“疑似敏感信息”，经人工复核全部为**误报**：

- `.***` 类命中：均为 `process.env.TEABLE_*` 等环境变量读取代码；
- `tok***KEN` / `tok***ken` 类命中：均为变量名 `token` / `TOKEN`，而非真实密钥值。

这些模式在公开模板代码中是正常且必要的，不构成泄露风险。

## 6. 结论

`teable-scheduling-system/` 已满足发布到公开仓库的最低脱敏要求，可以进入 GitHub 发布流程。

---

**下一步**：由仓库所有者确认后，初始化 git、提交并推送至 GitHub；启用 GitHub Pages 后 `docs/index.html` 可作为交互式演示页面访问。

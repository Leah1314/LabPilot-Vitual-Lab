---
type: project
status: active
updated: 2026-08-13
---

# LabPilot Virtual Lab

## 当前已知

- 本地工作区：`/Users/user/Documents/LabPilot Vitual Lab`
- 目标仓库：`Leah1314/LabPilot-Vitual-Lab`（开始实现时为空仓库）。
- 复用来源：`johnqh/daytona_hackathon` 的 Next.js 16 / React 19 / TypeScript / Tailwind dashboard 基础。
- 产品主循环：已有实验数据 → 可视化 → 统计分析 → AI 解释 → 推荐下一实验 → 虚拟模拟 → 科学家批准。
- P0 演示采用 Palbociclib / MCF-7 剂量响应数据；数值预测由 log-dose 插值计算，AI 只解释数据与模型输出。
- 2026-08-13：P0 dashboard 已在本地完成并通过 TypeScript 与生产构建；远程发布等待 GitHub CLI 重新认证。
- 2026-08-13：仓库首页 README 与 `dashboard/README.md` 已重写为 LabPilot Virtual Lab 产品叙事，明确当前技术路径为 OpenAI + 可选 AWS 持久化，而不是旧的 Fireworks-first hackathon 说明。

## 决策

- [[03-Decisions/2026-08-13 建立 Codex 长期记忆库]]

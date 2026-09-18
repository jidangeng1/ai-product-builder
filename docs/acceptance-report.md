# 诉捷 AI V0.1 验收报告

验收日期：2026-09-18  
分支：`feat/sujie-ai-v0.1`  
数据范围：仅使用仓库内明确标注的虚构演示数据

## 自动化与运行证据

| 检查 | 命令 | 结果 |
|---|---|---|
| 后端领域/API | `.venv/bin/python -m pytest backend/tests -q` | 12 passed |
| 前端用户流程 | `frontend/node_modules/.bin/vitest run` | 4 passed |
| TypeScript | `frontend/node_modules/.bin/tsc -b --pretty false` | 通过，0 error |
| 生产构建 | `frontend/node_modules/.bin/vite build` | 30 modules transformed，构建成功 |
| 凭据扫描 | `rg` 检查常见 token/私钥模式 | 未发现凭据模式 |
| 真实服务冒烟 | FastAPI 8100 + Vite 5174 + `curl`/`jq` | 前端 HTTP 正常；Case 1 从 `pending` 经未确认草稿进入 `closed`，4 条时间线事件 |

真实服务冒烟的最终摘要：

```json
{
  "health": { "status": "ok", "ai_mode": "mock" },
  "case_id": 1,
  "created_status": "pending",
  "draft_confirmed": false,
  "confirmed": true,
  "final_status": "closed",
  "timeline_events": 4,
  "frontend_http": "ok"
}
```

## `examples/sujie-v0.1.md` 验收标准

| # | 标准 | 结果与证据 |
|---:|---|---|
| 1 | 粘贴/选择虚构投诉并触发 mock AI 分析 | 通过；前端测试点击“使用虚构示例”和“AI 智能分析”，API 测试验证完整结构化契约。 |
| 2 | 结构化字段在建单前可编辑 | 通过；前端测试修改“确认责任科室”后建单，后端保留 AI 建议和人工确认值。 |
| 3 | 建单后出现在工作台 | 通过；API 测试验证 dashboard 最近工单和待办计数。 |
| 4 | 工单详情显示时间线和截止/状态 | 通过；前端与 API 测试均验证详情、首条时间线、deadline 和 `display_status`。 |
| 5 | 科室回复可录入并保存 | 通过；前端点击流程和后端持久化接口均覆盖。 |
| 6 | 可依据工单与科室回复生成回复草稿 | 通过；无科室回复时返回 409，有回复后生成包含工单/科室信息的草稿。 |
| 7 | 草稿必须经明确确认才算对外确认 | 通过；生成时 `confirmed=false` 且工单未关闭，点击人工确认后才变为 `true/closed`。 |
| 8 | 追加件关联既有工单 | 通过；追加件返回原 `case_id`，并进入该工单时间线与工作台计数。 |
| 9 | 撤件记录原因且不再超期 | 通过；空原因 422；有效原因保存时间/原因，状态和展示状态均固定为 `withdrawn`。 |
| 10 | 刷新/重启后 SQLite 保留工单 | 通过；测试用同一数据库路径重建 FastAPI 应用后成功读取原工单。 |
| 11 | README 可指导本地运行 | 通过；含 macOS/Linux、Windows 后端启动、前端启动、数据库路径和测试/构建命令。 |
| 12 | 不含真实患者/投诉人信息 | 通过；UI、fixture、mock 输出和文档均使用“虚构演示/虚构回复/虚构原因”标记。 |

## 通用 acceptance checklist

### Build

- 依赖安装、后端启动、前端开发服务和生产构建均完成。
- 未提交数据库、虚拟环境、依赖目录或构建目录；常见凭据模式扫描无结果。
- README 给出可复制的本地命令。

### UX

- 工作台到新建投诉、工单详情的入口可发现，Demo 中使用的按钮均由用户交互测试覆盖。
- 加载、空列表、成功和后端错误均有明确界面；必填字段与按钮禁用状态防止空操作。
- CSS 提供 980px 与 680px 响应式断点；常见笔记本宽度使用五列工作队列和双栏详情布局。
- 限制：所选云浏览器阻止访问本机 `127.0.0.1`（`ERR_BLOCKED_BY_CLIENT`），因此本轮没有浏览器截图证据。页面行为由真实服务 HTTP 冒烟和 jsdom 用户点击测试验证，布局由生产构建及响应式样式检查验证。

### Product / AI / Portfolio integrity

- 核心流程端到端成立；截止/超期/撤件/关闭由代码确定性处理。
- AI 科室建议与人工确认字段并存，AI 回复在确认前明确显示为草稿。
- mock 输出进入流程前由 Pydantic 校验；mock 模式不依赖 API Key。
- README 明确说明这是作品集原型，不声称生产部署、真实用户研究或真实医院集成。

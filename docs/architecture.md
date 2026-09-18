# 诉捷 AI V0.1 架构说明

## 目标与边界

V0.1 只验证一条垂直业务链：虚构投诉进入系统后，经过 mock AI 结构化、人工确认、工单办理、回复草稿人审并结束。它不模拟真实医院集成，不包含认证、RAG、真实模型调用或自动发送。

## 组件

### React 前端

`frontend/src/App.tsx` 提供工作台、新建投诉和工单详情三个界面。`frontend/src/api.ts` 是唯一 HTTP 边界，统一处理 JSON 与后端错误。UI 明确区分“AI 建议”“尚未对外确认”和人工确认后的状态。

### FastAPI 后端

`backend/app/main.py` 暴露工作台与工单流程 API，并编排确定性业务规则。`schemas.py` 定义输入与 mock AI 结构化输出的验证契约；`domain.py` 单独负责基于状态、截止时间和当前时间计算展示状态。

### AI 适配层

`backend/app/ai.py` 是 V0.1 的 mock provider。分析结果先构造成 `AnalysisResult`，因此即使未来替换为 OpenAI-compatible provider，也必须先通过同一 Pydantic 契约。模型不负责截止时间、超期、撤件或关闭等确定性判断。

### SQLite 持久化

`backend/app/database.py` 使用参数化 SQL 管理 `cases`、`timeline_events`、`department_replies` 和 `generated_replies`。每次请求读取持久化状态；刷新前端或重启服务不会丢失本地工单。

## 数据流

1. 用户提供明确标注为虚构的投诉内容。
2. mock provider 返回经校验的结构化建议。
3. 用户编辑并确认责任科室，后端创建 Case 与首条 TimelineEvent。
4. 后端用截止时间和当前时间确定性计算 `display_status`。
5. 科室回复保存后，mock provider 基于工单与科室回复生成未确认草稿。
6. 用户明确确认草稿后，GeneratedReply 标记为已确认，Case 进入 `closed`。
7. 追加件保存为关联原 Case 的 TimelineEvent；撤件记录原因和时间并进入 `withdrawn` 终态。

## 失败与安全处理

- 空内容、未标注虚构的投诉和空撤件原因由 Pydantic 拒绝。
- 缺少科室回复时，生成外部回复返回明确的 409 提示。
- 前端显示加载、空列表、成功和错误状态，失败操作不会被呈现为成功。
- SQLite 查询使用参数化参数；仓库忽略数据库、虚拟环境、依赖与构建产物。
- Demo 中的人员、事件、科室回复和日期均为虚构，不包含真实患者或投诉人数据。

## 测试边界

- `backend/tests/test_domain.py` 验证状态与持久化规则。
- `backend/tests/test_api.py` 从 API 边界覆盖建单、回复、确认、追加、撤件和重启持久化。
- `frontend/src/App.test.tsx` 从用户可见界面覆盖工作台发现性及主要按钮流程。

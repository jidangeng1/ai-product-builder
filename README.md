# 诉捷 AI V0.1

诉捷 AI 是一个使用纯虚构数据的医院 12345 投诉办理流程 Demo。它演示了从原始投诉、AI 辅助结构化、人工确认建单，到科室回复、AI 回复草稿、人审确认和结案的完整闭环。

> 这是作品集原型，不是已部署的医院系统。项目不连接真实 OA、12345 平台或患者数据，也不会自动发送任何回复。

## 已实现

- 工作台：待办、今日待回复、已超期、追加件、撤件和最近工单
- 新建投诉：选择虚构示例或粘贴明确标注为虚构的内容，运行 mock AI 分析，人工编辑后建单
- 工单办理：确定性时限/状态、时间线、科室回复、回复草稿、人审确认和结案
- 追加件与撤件：追加件关联原工单；撤件记录原因并停止超期计算
- SQLite 持久化：刷新或重启后保留本地 Demo 工单
- 默认 mock AI：不需要 API Key；结构化结果由 Pydantic 校验

## 技术栈

- 前端：React 19、TypeScript、Vite
- 后端：FastAPI、Pydantic
- 数据：SQLite（Python 标准库 `sqlite3`）
- 测试：Vitest + Testing Library、pytest + FastAPI TestClient

## 本地运行

需要 Node.js 20+ 和 Python 3.11+。打开两个终端，在仓库根目录分别启动后端和前端。

### 1. 后端

macOS / Linux：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Windows PowerShell：

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

默认数据库文件是仓库根目录的 `sujie.db`。如需指定路径：

```bash
SUJIE_DATABASE_PATH=/tmp/sujie-demo.db uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Windows PowerShell 对应写法：

```powershell
$env:SUJIE_DATABASE_PATH=".\sujie-demo.db"
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`。Vite 会把 `/api` 请求代理到 `http://127.0.0.1:8000`。

## 测试与构建

在仓库根目录运行后端测试：

```bash
.venv/bin/python -m pytest backend/tests -q
```

Windows PowerShell：

```powershell
.venv\Scripts\python -m pytest backend/tests -q
```

前端测试、类型检查和生产构建：

```bash
cd frontend
npm test -- --run
npm run typecheck
npm run build
```

## Mock AI 合约

分析输入是 `raw_complaint`；输出包含 `summary`、`request`、`event_time`、`category`、`suggested_department`、`urgency`、`key_facts` 和 `missing_information`。默认 mock provider 返回可重复的虚构结果，后端使用 Pydantic 在进入业务流程前校验结构。

责任科室始终需要人工确认。面向 12345 的回复始终先保存为未确认草稿，只有点击“人工确认并关闭工单”后才进入已确认状态；项目不会自动对外发送。

## 作品集表述

- 设计并实现医院 12345 投诉办理 Demo，以 React、FastAPI 和 SQLite 串联投诉结构化、工单跟踪、追加/撤件和回复人审闭环。
- 将 AI 建议与确定性业务规则分离：模型输出先经结构校验，责任科室和外部回复均保留人工确认门。
- 为核心流程编写后端集成测试和前端用户交互测试，并验证重启持久化、终态规则及生产构建。

架构与边界说明见 [`docs/architecture.md`](docs/architecture.md)，逐条验收记录见 [`docs/acceptance-report.md`](docs/acceptance-report.md)。

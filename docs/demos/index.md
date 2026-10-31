---
title: 13 · 可直接运行的实战 Demo
description: 最简 Python Skill Hub、MCP 接入、LangGraph 动态加载、Docker 沙箱、审计看板、Compose 部署与校验模板，全部可复制运行。
outline: [2, 3]
---

# 13 · 可直接运行的实战 Demo

这一章不写伪代码。所有片段都能在本机跑起来，**先跑通，再改造**。

::: tip 全章一句话
最小可用的技能中心只需要 **三个接口 + 两张表**。剩下的能力（沙箱、计费、灰度）都是在这套骨架上加，不是重写。
:::

## 00 整体结构 {#overview}

<Diagram id="demo-topo" />

```text
skillhub-demo/
├── app.py                 # 三个接口 + 校验 + 审计（本章 01）
├── skills/
│   └── order.lookup/
│       ├── skill.yaml
│       └── handler.py
├── scripts/
│   ├── onboard_mcp.py     # MCP 接入（02）
│   ├── langgraph_agent.py # 动态加载（03）
│   └── validate.py        # 清单校验（07）
├── sandbox/               # 沙箱镜像（04）
│   ├── Dockerfile
│   └── runner.py
├── docker-compose.yml     # 一键部署（06）
└── requirements.txt
```

```text
fastapi==0.115.*
uvicorn[standard]==0.32.*
jsonschema==4.23.*
pyyaml==6.0.*
mcp==1.2.*
docker==7.1.*
```

## 01 最简 Python Skill Hub {#minimal}

`app.py`：注册、查询、调用三件套，附参数校验与审计落库。

```python
# app.py
import json, sqlite3, time, uuid
from pathlib import Path
import jsonschema, yaml
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

DB = Path("hub.db")
app = FastAPI(title="skillhub-demo")

def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init():
    with db() as c:
        c.executescript("""
        create table if not exists skills(
          name text primary key, version text, description text,
          input_schema text, output_schema text, scopes text,
          tenant_scope text, timeout_ms int, status text);
        create table if not exists audit(
          id integer primary key autoincrement, ts real, tenant text,
          subject text, skill text, version text, decision text,
          error_code text, latency_ms int, args_digest text, trace_id text);
        """)
init()

# ---------- 1. 注册 ----------
@app.post("/v1/skills")
def register(manifest: dict):
    # 演示：直接接收已解析的 dict；生产环境应读 manifest 文件并做完整校验
    for k in ("name", "version", "description", "input_schema"):
        if k not in manifest:
            raise HTTPException(400, f"manifest missing {k}")
    jsonschema.Draft202012Validator.check_schema(manifest["input_schema"])
    with db() as c:
        c.execute("""insert or replace into skills values(?,?,?,?,?,?,?,?,?)""", (
            manifest["name"], manifest["version"], manifest["description"],
            json.dumps(manifest["input_schema"]),
            json.dumps(manifest.get("output_schema", {})),
            json.dumps(manifest.get("scopes", [])),
            json.dumps(manifest.get("tenant_scope", ["*"])),
            manifest.get("timeout_ms", 2000), "ga"))
    return {"ok": True, "name": manifest["name"]}

# ---------- 2. 查询 ----------
@app.get("/v1/skills")
def list_skills(tenant: str = "cs"):
    with db() as c:
        rows = c.execute("select * from skills where status='ga'").fetchall()
    out = []
    for r in rows:
        if "*" in json.loads(r["tenant_scope"]) or tenant in json.loads(r["tenant_scope"]):
            out.append({"name": r["name"], "version": r["version"],
                        "description": r["description"],
                        "input_schema": json.loads(r["input_schema"])})
    return {"revision": str(int(time.time())), "skills": out}

# ---------- 3. 调用 ----------
class Invoke(BaseModel):
    skill: str
    args: dict = {}
    tenant: str = "cs"
    subject: str = "user:demo"

@app.post("/v1/skills/invoke")
def invoke(body: Invoke, authorization: str = Header(default="")):
    trace_id = uuid.uuid4().hex
    started = time.time()
    row = db().execute("select * from skills where name=?", (body.skill,)).fetchone()
    if not row:
        return fail("SKILL_NOT_FOUND", trace_id, 404)

    schema = json.loads(row["input_schema"])
    errors = sorted(jsonschema.Draft202012Validator(schema).iter_errors(body.args),
                    key=lambda e: e.path)
    if errors:
        return fail("INVALID_ARGUMENTS", trace_id, 400,
                    detail=[{"path": list(e.path), "msg": e.message} for e in errors[:3]])

    handler = load_handler(row["name"])          # 见下
    try:
        result = handler(**body.args)
    except TimeoutError:
        return fail("UPSTREAM_TIMEOUT", trace_id, 504)

    latency = int((time.time() - started) * 1000)
    audit(body, row, "allow", None, latency, trace_id)
    return {"ok": True, "data": result, "trace_id": trace_id,
            "skill_version": row["version"]}

def fail(code, trace_id, status, detail=None):
    raise HTTPException(status_code=status, detail={
        "ok": False,
        "error": {"code": code, "retryable": code == "UPSTREAM_TIMEOUT",
                  "trace_id": trace_id, "detail": detail or {}}})

def load_handler(name: str):
    module = __import__(f"skills.{name}.handler", fromlist=["run"])
    return module.run

def audit(body, row, decision, error_code, latency, trace_id):
    digest = "sha256:" + uuid.uuid5(uuid.NAMESPACE_OID, json.dumps(body.args)).hex[:16]
    with db() as c:
        c.execute("""insert into audit(ts,tenant,subject,skill,version,decision,
                     error_code,latency_ms,args_digest,trace_id)
                     values(?,?,?,?,?,?,?,?,?,?)""",
                  (time.time(), body.tenant, body.subject, body.skill, row["version"],
                   decision, error_code, latency, digest, trace_id))
```

配套技能：

```python
# skills/order/lookup/handler.py  （按 name 拆目录：order.lookup -> skills/order/lookup）
ORDERS = {"202603020001": {"status": "paid", "paid_at": "2026-03-02T10:11:00Z"}}

def run(order_id: str):
    if order_id not in ORDERS:
        raise ValueError("ORDER_NOT_FOUND")
    return ORDERS[order_id]
```

跑起来验证：

```bash
pip install -r requirements.txt
uvicorn app:app --port 8080

# 注册
curl -s -X POST localhost:8080/v1/skills -H 'content-type: application/json' -d '{
  "name":"order.lookup","version":"1.4.0",
  "description":"按订单号查询订单状态。用户提供订单号时使用；不要用于按手机号查单。",
  "input_schema":{"type":"object","required":["order_id"],"additionalProperties":false,
                  "properties":{"order_id":{"type":"string","pattern":"^[0-9]{12,20}$"}}},
  "tenant_scope":["cs"]}'

# 查询
curl -s 'localhost:8080/v1/skills?tenant=cs'

# 调用
curl -s -X POST localhost:8080/v1/skills/invoke -H 'content-type: application/json' \
  -d '{"skill":"order.lookup","args":{"order_id":"202603020001"}}'
```

::: warning 这是演示，不是生产
它没有鉴权、没有租户隔离、没有配额、技能是直接 `import` 执行的。**它的价值是让你 30 分钟看到骨架**，生产版请回到第 02 / 06 章补齐。
:::

## 02 MCP Server 接入示例 {#mcp}

<Source href="https://modelcontextprotocol.io/" org="MCP" label="官方 SDK：Python 客户端" />

```python
# scripts/onboard_mcp.py
import asyncio, json
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SERVER = StdioServerParameters(command="npx", args=["-y", "@modelcontextprotocol/server-filesystem", "."])

async def main():
    async with stdio_client(SERVER) as (read, write):
        async with ClientSession(read, write) as s:
            init = await s.initialize()
            print("server:", init.serverInfo.name, init.protocolVersion)

            tools = (await s.list_tools()).tools
            manifests = []
            for t in tools:
                manifests.append({
                    "name": f"fs.{t.name}",                  # 前缀防撞名
                    "version": "0.1.0",
                    "description": t.description or "",
                    "input_schema": t.inputSchema,
                    "scopes": ["fs:read"],
                    "tenant_scope": ["cs"],
                    "backend": {"kind": "mcp", "tool": t.name},
                })
            json.dump(manifests, open("mcp_import.json", "w"), indent=2, ensure_ascii=False)
            print(f"imported {len(manifests)} tools")

            # 顺手验证一次调用
            first = tools[0].name
            result = await s.call_tool(first, {"path": "."})
            print("sample call:", str(result.content)[:200])

asyncio.run(main())
```

接入后的路由映射：

```python
# 在 app.py 的执行层加一个分支：backend.kind == "mcp" 时走 MCP 客户端
async def call_mcp(server_id: str, tool: str, args: dict):
    async with stdio_client(pool.params(server_id)) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            res = await s.call_tool(tool, args)
            if res.isError:                      # 关键：映射成自己的错误码
                raise UpstreamError("UPSTREAM_UNAVAILABLE")
            return json.loads(res.content[0].text)
```

## 03 LangGraph Agent 动态加载技能 {#langgraph}

<Source href="https://langchain-ai.github.io/langgraph/" org="LangGraph" label="官方文档：状态图与工具节点" />

```python
# scripts/langgraph_agent.py
import httpx
from langchain_openai import ChatOpenAI
from langchain_core.tools import StructuredTool
from langgraph.prebuilt import create_react_agent

HUB = "http://localhost:8080"

def fetch_tools(query: str, tenant: str = "cs", k: int = 8):
    """从 Hub 拉技能，转成 LangChain 工具（演示版：不做检索，取前 k 个）"""
    skills = httpx.get(f"{HUB}/v1/skills", params={"tenant": tenant}).json()["skills"][:k]
    tools = []
    for s in skills:
        def _run(_name=s["name"], **kwargs):
            r = httpx.post(f"{HUB}/v1/skills/invoke", json={
                "skill": _name, "args": kwargs, "tenant": tenant, "subject": "agent:demo",
            }, timeout=30).json()
            if not r.get("ok"):
                return f"error:{r['detail']['error']['code']}"       # 错误码进上下文
            return r["data"]

        tools.append(StructuredTool.from_function(
            func=_run, name=s["name"].replace(".", "_"),
            description=s["description"],
        ))
    return tools

def build_agent(query: str):
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    return create_react_agent(llm, fetch_tools(query))

if __name__ == "__main__":
    agent = build_agent("帮我查一下订单 202603020001 的状态")
    out = agent.invoke({"messages": [{"role": "user",
                                      "content": "帮我查一下订单 202603020001 的状态"}]})
    print(out["messages"][-1].content)
```

::: warning 工具名不能带点
大多数模型/框架要求工具名匹配 `^[a-zA-Z0-9_-]+$`。**Hub 里的 `order.lookup` 绑定到模型时要转成 `order_lookup`**，映射关系留在你自己的代码里。
:::

## 04 Docker 沙箱执行 Demo {#sandbox}

```dockerfile
# sandbox/Dockerfile
FROM python:3.12-slim
RUN useradd -m -u 10001 runner
WORKDIR /work
USER runner
ENTRYPOINT ["python", "/work/runner.py"]
```

```python
# sandbox/runner.py —— 只读输入、受限输出
import json, os, sys

def main():
    payload = json.load(open("/work/input.json"))
    ns = {}
    exec(compile(open("/work/handler.py").read(), "handler.py", "exec"), ns)
    result = ns["run"](**payload.get("args", {}))
    out = json.dumps({"ok": True, "data": result}, ensure_ascii=False)[:64_000]
    sys.stdout.write(out)

if __name__ == "__main__":
    main()
```

```python
# 执行侧：六个开关全部打开
import docker, tempfile, json

def run_sandbox(code: str, args: dict, timeout=8):
    client = docker.from_env()
    with tempfile.TemporaryDirectory() as d:
        open(f"{d}/handler.py", "w").write(code)
        json.dump({"args": args}, open(f"{d}/input.json", "w"))
        c = client.containers.run(
            "skill-sandbox:1.0", detach=True,
            volumes={d: {"bind": "/work", "mode": "ro"}},
            network_disabled=True, read_only=True, mem_limit="256m",
            nano_cpus=500_000_000, pids_limit=128, user="10001",
        )
        try:
            c.wait(timeout=timeout)
        except Exception:
            c.kill(); return {"ok": False, "error": {"code": "SANDBOX_TIMEOUT"}}
        finally:
            logs = c.logs()[:64_000].decode()
            c.remove(force=True)
    return json.loads(logs)
```

```bash
docker build -t skill-sandbox:1.0 sandbox/
```

::: danger 挂载必须是 `ro`
输入目录只读，输出走 stdout。**可写的挂载目录就是攻击者的落脚点**，能省则省。
:::

## 05 审计日志与统计看板 {#audit}

最简看板：两个 SQL + 一个 HTML 页面。

```python
# 在 app.py 追加
@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(days: int = 7):
    with db() as c:
        top = c.execute("""
          select skill, count(*) calls, avg(latency_ms) avg_ms,
                 sum(case when decision='allow' then 0 else 1 end) denied
          from audit where ts > strftime('%s','now') - ?*86400
          group by skill order by calls desc limit 20""", (days,)).fetchall()
        trend = c.execute("""
          select date(ts,'unixepoch') d, count(*) calls
          from audit group by d order by d desc limit 14""").fetchall()
    rows = "".join(f"<tr><td>{r['skill']}</td><td>{r['calls']}</td>"
                   f"<td>{r['avg_ms']:.0f}</td><td>{r['denied']}</td></tr>" for r in top)
    return f"""<html><body style="font-family:system-ui">
      <h2>Skill Hub · 近 {days} 天</h2>
      <table border=1 cellpadding=6><tr><th>技能</th><th>调用</th><th>平均耗时</th><th>拒绝</th></tr>
      {rows}</table>
      <p>日趋势：{[(r['d'], r['calls']) for r in trend]}</p></body></html>"""
```

三个必须能在看板上回答的问题：

| 问题 | 对应查询 |
| --- | --- |
| 谁在调、调了多少 | `group by tenant` |
| 哪些技能在报错 | `where error_code is not null group by skill` |
| 有多少次被拒绝 | `where decision='denied' group by skill` |

## 06 Docker Compose 一键部署 {#compose}

```yaml
# docker-compose.yml
services:
  hub:
    build: .
    ports: ["8080:8080"]
    environment:
      DB_PATH: /data/hub.db
      LOG_LEVEL: info
    volumes: ["hubdata:/data"]
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request;urllib.request.urlopen('http://localhost:8080/v1/skills')"]
      interval: 15s
      timeout: 3s
      retries: 3

volumes:
  hubdata:
```

```dockerfile
# Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py skills ./ 
RUN mkdir -p /data
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
```

```bash
docker compose up -d --build
curl -s localhost:8080/v1/skills?tenant=cs
open http://localhost:8080/dashboard
```

::: tip 从 Demo 到生产的差距清单
鉴权、租户隔离、配额、版本通道、沙箱、MCP 池化——**这六项补完，才算能接真实流量**。每一项在第 02 / 05 / 06 章都有对应实现。
:::

## 07 元数据模板与校验 {#schema}

```python
# scripts/validate.py
import json, sys, glob, yaml, jsonschema

MANIFEST_SCHEMA = {
    "type": "object",
    "required": ["name", "version", "description", "input_schema", "owner"],
    "additionalProperties": True,
    "properties": {
        "name": {"type": "string", "pattern": r"^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$"},
        "version": {"type": "string", "pattern": r"^\d+\.\d+\.\d+$"},
        "description": {"type": "string", "minLength": 40, "maxLength": 1024},
        "input_schema": {"type": "object"},
        "scopes": {"type": "array", "items": {"type": "string"}},
        "timeout_ms": {"type": "integer", "minimum": 100, "maximum": 60000},
    },
}

def main(paths):
    bad = 0
    for p in paths:
        m = yaml.safe_load(open(p, encoding="utf-8"))
        errs = list(jsonschema.Draft202012Validator(MANIFEST_SCHEMA).iter_errors(m))
        # 额外规则：描述必须包含「不要用于」
        if "不要用于" not in m.get("description", "") and "Do not use" not in m.get("description", ""):
            errs.append("description should state when NOT to use this skill")
        if errs:
            bad += 1
            print(f"✘ {p}")
            for e in errs:
                print("   -", getattr(e, "message", e))
        else:
            print(f"✔ {p}")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main(sys.argv[1:] or glob.glob("skills/**/skill.yaml", recursive=True))
```

接进 CI：

```yaml
# .github/workflows/skills.yml
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: {python-version: "3.12"}
      - run: pip install pyyaml jsonschema
      - run: python scripts/validate.py
```

## 参考来源 {#refs}

<Source href="https://modelcontextprotocol.io/" org="MCP" label="官方 SDK 与示例 Server" />
<Source href="https://langchain-ai.github.io/langgraph/" org="LangGraph" label="create_react_agent 与工具绑定" />
<Source href="https://docs.docker.com/engine/security/" org="Docker" label="容器隔离与安全选项" />
<Source href="https://json-schema.org/" org="JSON Schema" label="Draft 2020-12 校验" />
<Source href="https://fastapi.tiangolo.com/" org="FastAPI" label="接口与依赖注入" />

## 下一章 {#next}

跑通了，接着让它跑得快：[14 · 性能优化与大规模扩展](/performance/)。

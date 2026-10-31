---
title: 13 · Runnable demos
description: A minimal Python hub, MCP onboarding, LangGraph dynamic loading, a Docker sandbox, an audit dashboard, one-command Compose and manifest validation.
outline: [2, 3]
---

# 13 · Runnable demos

No pseudocode. Everything here runs locally — **get it running first, then change it**.

::: tip The chapter in one line
The smallest useful hub is **three endpoints and two tables**. Everything else — sandboxes, billing, canary — is added to that skeleton, not a rewrite of it.
:::

## 00 Layout {#overview}

<Diagram id="demo-topo" />

```text
skillhub-demo/
├── app.py                 # three endpoints + validation + audit (section 01)
├── skills/
│   └── order.lookup/
│       ├── skill.yaml
│       └── handler.py
├── scripts/
│   ├── onboard_mcp.py     # MCP onboarding (02)
│   ├── langgraph_agent.py # dynamic loading (03)
│   └── validate.py        # manifest checks (07)
├── sandbox/               # sandbox image (04)
│   ├── Dockerfile
│   └── runner.py
├── docker-compose.yml     # one command (06)
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

## 01 Minimal Python hub {#minimal}

`app.py`: register, list, invoke — with schema validation and an audit row.

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

# ---------- 1. register ----------
@app.post("/v1/skills")
def register(manifest: dict):
    # Demo: a parsed dict. Production reads a manifest file and validates fully.
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

# ---------- 2. list ----------
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

# ---------- 3. invoke ----------
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

    handler = load_handler(row["name"])
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

The skill it serves:

```python
# skills/order/lookup/handler.py  (dots become directories: order.lookup -> skills/order/lookup)
ORDERS = {"202603020001": {"status": "paid", "paid_at": "2026-03-02T10:11:00Z"}}

def run(order_id: str):
    if order_id not in ORDERS:
        raise ValueError("ORDER_NOT_FOUND")
    return ORDERS[order_id]
```

Run and verify:

```bash
pip install -r requirements.txt
uvicorn app:app --port 8080

# register
curl -s -X POST localhost:8080/v1/skills -H 'content-type: application/json' -d '{
  "name":"order.lookup","version":"1.4.0",
  "description":"Look up order status by order id. Use when the user supplies an id; do not use for phone search.",
  "input_schema":{"type":"object","required":["order_id"],"additionalProperties":false,
                  "properties":{"order_id":{"type":"string","pattern":"^[0-9]{12,20}$"}}},
  "tenant_scope":["cs"]}'

# list
curl -s 'localhost:8080/v1/skills?tenant=cs'

# invoke
curl -s -X POST localhost:8080/v1/skills/invoke -H 'content-type: application/json' \
  -d '{"skill":"order.lookup","args":{"order_id":"202603020001"}}'
```

::: warning This is a demo, not production
No auth, no tenant isolation, no quotas, and skills are `import`ed and executed directly. **Its value is seeing the skeleton in 30 minutes.** The production version needs chapters 02 and 06.
:::

## 02 MCP server onboarding {#mcp}

<Source href="https://modelcontextprotocol.io/" org="MCP" label="Official SDKs: Python client" />

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
                    "name": f"fs.{t.name}",                  # prefix prevents collisions
                    "version": "0.1.0",
                    "description": t.description or "",
                    "input_schema": t.inputSchema,
                    "scopes": ["fs:read"],
                    "tenant_scope": ["cs"],
                    "backend": {"kind": "mcp", "tool": t.name},
                })
            json.dump(manifests, open("mcp_import.json", "w"), indent=2, ensure_ascii=False)
            print(f"imported {len(manifests)} tools")

            # verify one call while we are here
            first = tools[0].name
            result = await s.call_tool(first, {"path": "."})
            print("sample call:", str(result.content)[:200])

asyncio.run(main())
```

Mapping at execution time:

```python
# In the execution layer: when backend.kind == "mcp", go through the client
async def call_mcp(server_id: str, tool: str, args: dict):
    async with stdio_client(pool.params(server_id)) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            res = await s.call_tool(tool, args)
            if res.isError:                      # key: map to your own error codes
                raise UpstreamError("UPSTREAM_UNAVAILABLE")
            return json.loads(res.content[0].text)
```

## 03 LangGraph dynamic loading {#langgraph}

<Source href="https://langchain-ai.github.io/langgraph/" org="LangGraph" label="State graphs and tool nodes" />

```python
# scripts/langgraph_agent.py
import httpx
from langchain_openai import ChatOpenAI
from langchain_core.tools import StructuredTool
from langgraph.prebuilt import create_react_agent

HUB = "http://localhost:8080"

def fetch_tools(query: str, tenant: str = "cs", k: int = 8):
    """Pull skills from the hub and turn them into LangChain tools (demo: first k, no retrieval)"""
    skills = httpx.get(f"{HUB}/v1/skills", params={"tenant": tenant}).json()["skills"][:k]
    tools = []
    for s in skills:
        def _run(_name=s["name"], **kwargs):
            r = httpx.post(f"{HUB}/v1/skills/invoke", json={
                "skill": _name, "args": kwargs, "tenant": tenant, "subject": "agent:demo",
            }, timeout=30).json()
            if not r.get("ok"):
                return f"error:{r['detail']['error']['code']}"       # codes go into context
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
    agent = build_agent("check the status of order 202603020001")
    out = agent.invoke({"messages": [{"role": "user",
                                      "content": "check the status of order 202603020001"}]})
    print(out["messages"][-1].content)
```

::: warning Tool names cannot contain dots
Most models and frameworks require `^[a-zA-Z0-9_-]+$`. **Map `order.lookup` to `order_lookup` at the model boundary** and keep the mapping in your own code.
:::

## 04 Docker sandbox demo {#sandbox}

```dockerfile
# sandbox/Dockerfile
FROM python:3.12-slim
RUN useradd -m -u 10001 runner
WORKDIR /work
USER runner
ENTRYPOINT ["python", "/work/runner.py"]
```

```python
# sandbox/runner.py — read-only input, bounded output
import json, sys

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
# Caller: all six switches on
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

::: danger Mount read-only
Inputs are read-only and output goes to stdout. **A writable mount is a foothold for an attacker** — avoid it whenever possible.
:::

## 05 Audit log and dashboard {#audit}

The smallest dashboard: two queries and one HTML page.

```python
# append to app.py
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
      <h2>Skill Hub · last {days} days</h2>
      <table border=1 cellpadding=6><tr><th>Skill</th><th>Calls</th><th>Avg ms</th><th>Denied</th></tr>
      {rows}</table>
      <p>Daily trend: {[(r['d'], r['calls']) for r in trend]}</p></body></html>"""
```

Three questions the dashboard must answer:

| Question | Query |
| --- | --- |
| Who calls what, how much | `group by tenant` |
| Which skills fail | `where error_code is not null group by skill` |
| How often are calls denied | `where decision='denied' group by skill` |

## 06 One-command Compose deploy {#compose}

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

::: tip The gap between demo and production
Auth, tenant isolation, quotas, version channels, sandboxing, MCP pooling. **Finish those six and it can take real traffic.** Each has an implementation in chapters 02, 05 and 06.
:::

## 07 Manifest template and validation {#schema}

```python
# scripts/validate.py
import sys, glob, yaml, jsonschema

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
        # Extra rule: the description must say when NOT to use the skill
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

Wire it into CI:

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

## 08 Sources {#refs}

<Source href="https://modelcontextprotocol.io/" org="MCP" label="Official SDKs and sample servers" />
<Source href="https://langchain-ai.github.io/langgraph/" org="LangGraph" label="create_react_agent and tool binding" />
<Source href="https://docs.docker.com/engine/security/" org="Docker" label="Container isolation and security options" />
<Source href="https://json-schema.org/" org="JSON Schema" label="Draft 2020-12 validation" />
<Source href="https://fastapi.tiangolo.com/" org="FastAPI" label="Endpoints and dependency injection" />

## Next {#next}

It runs. Now make it run fast: [14 · Performance at scale](/en/performance/).

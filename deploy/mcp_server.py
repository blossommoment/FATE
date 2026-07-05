"""FATE MCP 服务 —— 把现有 FATE REST 接口套成 MCP 工具(A2MCP 上架用)。
业务逻辑全在 /api/agent/deep-report,本文件只做 MCP 协议套壳 + 转发。
"""
import os
import time
import uuid
import json
import base64
import httpx
from fastmcp import FastMCP

FATE_API = os.environ.get("FATE_API", "http://127.0.0.1:3000/api/agent/deep-report")
# 内部免费通道的钥匙:必须由环境注入,严禁写默认值(入库=任何人可绕过 x402 白拿报告)
API_KEY = os.environ["FATE_API_KEY"]
PUBLIC_DIR = os.environ.get("FATE_PUBLIC_DIR", "/opt/fate/app/public/reports")
PUBLIC_BASE = os.environ.get("FATE_PUBLIC_BASE", "https://47-74-45-38.nip.io/reports")

# ---- x402 支付网关参数(A2MCP 上架必需:无凭证→402,带凭证→放行) ----
X402_NETWORK = os.environ.get("X402_NETWORK", "eip155:196")            # X Layer 主网
X402_ASSET = os.environ.get("X402_ASSET", "0x779ded0c9e1022225f8e0630b35a9b54be713736")  # USDT@X Layer
X402_AMOUNT = os.environ.get("X402_AMOUNT", "10000000")                # 10 USDT (6 位小数)
X402_PAYTO = os.environ.get("X402_PAYTO", "0x106c6bcab5e871e95757bfd149cb2f41a56e4b7a")  # 收款=用户 Agentic Wallet
X402_RESOURCE = os.environ.get("X402_RESOURCE", "https://47-74-45-38.nip.io/mcp")
X402_ASSET_NAME = os.environ.get("X402_ASSET_NAME", "USDT")            # EIP-712 域名(EIP-3009 签名用)
X402_ASSET_VERSION = os.environ.get("X402_ASSET_VERSION", "1")

mcp = FastMCP(
    name="FATE 东方命理",
    instructions=(
        "东方命理深度人格报告服务。输入一个人的出生信息，生成一份基于传统历法结构与"
        "行为模型推演的深度人格报告 PDF（综合评定、五年流年、四柱命盘、五行十神、十二维、"
        "专长天赋）。内容仅供娱乐与自我认知参考，不作吉凶断言。"
    ),
)


@mcp.tool()
async def get_fate_report(
    year: int,
    month: int,
    day: int,
    hour: int,
    name: str = "",
    gender: str = "male",
    calendar_type: str = "solar",
    lang: str = "zh",
) -> str:
    """生成东方命理深度人格报告并返回 PDF 下载链接。

    参数:
        year: 出生年(公历或农历,由 calendar_type 决定),如 1998
        month: 出生月 1-12
        day: 出生日 1-31
        hour: 出生小时,24 时制 0-23。只知道时辰的取中点(子0/丑2/寅4/卯6/辰8/巳10/午12/未14/申16/酉18/戌20/亥22)
        name: 姓名(用于报告行文),可选
        gender: 性别 "male" 或 "female"(影响大运排法)
        calendar_type: 历法 "solar"(公历)或 "lunar"(农历)
        lang: 语言 "zh"(中文)或 "en"(英文,会多花一次翻译时间)
    返回:
        报告 PDF 的公网下载链接;失败则返回错误说明。
    """
    payload = {
        "birth": {
            "year": year,
            "month": month,
            "day": day,
            "hour": hour,
            "name": name or "访客",
            "gender": gender,
            "calendarType": calendar_type,
        },
        "lang": lang,
    }
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(FATE_API, json=payload, headers={"X-API-Key": API_KEY})
    except Exception as e:  # noqa: BLE001
        return f"生成失败(无法连接后厨): {e}"

    if resp.status_code != 200:
        detail = resp.text[:300]
        return f"生成失败: HTTP {resp.status_code} {detail}"

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    fid = uuid.uuid4().hex
    out_path = os.path.join(PUBLIC_DIR, f"{fid}.pdf")
    with open(out_path, "wb") as f:
        f.write(resp.content)
    kb = len(resp.content) // 1024
    return (
        f"报告已生成:{_public_base()}/{fid}.pdf ({kb} KB)。"
        "内容仅供娱乐与自我认知参考,不作吉凶断言。"
    )


def _public_base() -> str:
    """PDF 链接域名跟随请求 Host(双域名各自正确);取不到时退回 FATE_PUBLIC_BASE。"""
    try:
        from fastmcp.server.dependencies import get_http_request

        host = get_http_request().headers.get("host", "").strip().lower()
        if _safe_host(host):
            return f"https://{host}/reports"
    except Exception:  # noqa: BLE001
        pass
    return PUBLIC_BASE


# 合法域名硬名单(可用 env 扩展)——不在名单的 Host 一律退回 env 兜底值
X402_ALLOWED_HOSTS = frozenset(
    h.strip().lower()
    for h in os.environ.get(
        "X402_ALLOWED_HOSTS", "47-74-45-38.nip.io,fatemodel.cn,www.fatemodel.cn"
    ).split(",")
    if h.strip()
)


def _safe_host(host: str) -> bool:
    """名副其实的白名单:只认名单内域名,反射型 Host 直接出局。"""
    return host.lower() in X402_ALLOWED_HOSTS


def _request_resource(scope) -> str:
    """resource 跟随请求 Host 动态生成——nip.io 与 fatemodel.cn 双域名同时正确,
    切域名不用改 env。取不到 Host 时退回 X402_RESOURCE。"""
    try:
        headers = dict(scope.get("headers") or [])
        host = headers.get(b"host", b"").decode("latin-1").strip().lower()
        if _safe_host(host):
            proto = headers.get(b"x-forwarded-proto", b"https").decode("latin-1") or "https"
            return f"{proto}://{host}{scope.get('path') or '/mcp'}"
    except Exception:  # noqa: BLE001
        pass
    return X402_RESOURCE


def _build_challenge(resource: str) -> dict:
    """x402 v1/v2 兼容的支付挑战。买家据此在 X Layer 付 10 USDT 后重放请求。"""
    return {
        "x402Version": 1,
        "error": "X-PAYMENT header is required",
        "accepts": [
            {
                "scheme": "exact",
                "network": X402_NETWORK,
                "maxAmountRequired": X402_AMOUNT,   # v1 字段名
                "amount": X402_AMOUNT,              # v2 字段名
                "resource": resource,
                "description": "FATE 东方命理深度人格报告 PDF(单人)",
                "mimeType": "application/json",
                "payTo": X402_PAYTO,
                "maxTimeoutSeconds": 300,
                "asset": X402_ASSET,
                "extra": {"name": X402_ASSET_NAME, "version": X402_ASSET_VERSION},
            }
        ],
    }


async def _send_402(send, scope=None) -> None:
    challenge = _build_challenge(_request_resource(scope) if scope else X402_RESOURCE)
    body = json.dumps(challenge, ensure_ascii=False).encode("utf-8")
    # PAYMENT-REQUIRED 头必须是 ASCII → base64 时用 ensure_ascii=True
    b64 = base64.b64encode(
        json.dumps(challenge, ensure_ascii=True).encode("utf-8")
    ).decode("ascii")
    headers = [
        (b"content-type", b"application/json; charset=utf-8"),
        (b"payment-required", b64.encode("ascii")),
        (b"cache-control", b"no-store"),
    ]
    await send({"type": "http.response.start", "status": 402, "headers": headers})
    await send({"type": "http.response.body", "body": body})


# ---- 影子验签(先采样后拦截) ----
# X402_ENFORCE=0(默认):对凭证做结构校验+记样本日志,但不拦截 —— 先抓真实买家
# 凭证的线格式,坐实后再开拦截,避免盲写验签误杀正常买家(丢一单比被白嫖一份贵)。
# X402_ENFORCE=1:结构校验不过 → 402。⚠️ 暂无 ecrecover 真验签,等格式坐实后补。
X402_ENFORCE = os.environ.get("X402_ENFORCE", "0") == "1"
X402_LOG = os.environ.get("X402_LOG", "/opt/fate/mcp/x402_samples.log")
# 重放宽限期:窗口内同 nonce 视为买家网络重试(放行),超窗才判 REPLAY——
# 付过钱的买家超时重试不能被误杀,批量白嫖(隔小时重放)才要拦
X402_REPLAY_GRACE = int(os.environ.get("X402_REPLAY_GRACE", "600"))
X402_NONCE_FILE = os.environ.get("X402_NONCE_FILE", "/opt/fate/mcp/x402_nonces.log")

_seen_nonces: dict = {}  # nonce → 首见时间戳;落盘续命,pm2 重启不丢


def _load_nonces() -> None:
    try:
        with open(X402_NONCE_FILE, encoding="utf-8") as f:
            for ln in f:
                parts = ln.split()
                if len(parts) == 2:
                    _seen_nonces[parts[1]] = float(parts[0])
    except FileNotFoundError:
        pass
    except Exception:  # noqa: BLE001 损坏的记录文件不挡启动
        pass


_load_nonces()


def _record_nonce(nonce: str, ts: float) -> None:
    _seen_nonces[nonce] = ts
    try:
        with open(X402_NONCE_FILE, "a", encoding="utf-8") as f:
            f.write(f"{ts:.0f} {nonce}\n")
    except Exception:  # noqa: BLE001
        pass


def _extract_payment(headers: dict):
    """从请求头取支付凭证原文(base64 bytes);没有 → None。"""
    for k in (b"x-payment", b"payment-signature", b"x-payment-signature"):
        if k in headers:
            return headers[k]
    auth = headers.get(b"authorization", b"")
    if auth[:8].lower() == b"payment ":
        return auth[8:]
    return None


def _shadow_verify(raw: bytes):
    """结构校验支付凭证(不做 ecrecover)。返回 (通过?, 说明)。"""
    try:
        # 归一化 base64url(-_)→标准表(+/):标准 b64decode 会静默丢弃非表内字符,
        # OKX 若发 base64url 不归一会解出脏数据,影子采样全废
        norm = raw.replace(b"-", b"+").replace(b"_", b"/")
        data = json.loads(base64.b64decode(norm + b"=" * (-len(norm) % 4)))
    except Exception as e:  # noqa: BLE001
        return False, f"undecodable({e})"
    problems = []
    infos = []
    payload = data.get("payload") or {}
    auth_obj = payload.get("authorization") or payload.get("permit2Authorization") or {}
    to = str(auth_obj.get("to", ""))
    value = str(auth_obj.get("value", "") or auth_obj.get("amount", ""))
    nonce = str(auth_obj.get("nonce", ""))
    net = data.get("network")
    if net and net != X402_NETWORK:
        problems.append(f"network={net}")
    if to and to.lower() != X402_PAYTO.lower():
        problems.append(f"payTo={to}")
    if value:
        try:
            if int(value) < int(X402_AMOUNT):
                problems.append(f"underpaid={value}")
        except ValueError:
            problems.append(f"badValue={value}")
    if not (payload.get("signature") or data.get("signature")):
        problems.append("noSignature")
    if nonce:
        now = time.time()
        first = _seen_nonces.get(nonce)
        if first is None:
            _record_nonce(nonce, now)
        elif now - first > X402_REPLAY_GRACE:
            problems.append("REPLAY")  # 超宽限期重放:转正(ENFORCE=1)后拦
        else:
            infos.append("retry-in-grace")  # 宽限期内=买家重试,放行只记录
    note = ";".join(problems) if problems else ("structural-ok" + ("," + ",".join(infos) if infos else ""))
    return (not problems), note


def _log_sample(raw: bytes, ok: bool, note: str) -> None:
    """凭证原文记档 —— 真实买家样本是后续写正式验签的依据。日志失败绝不挡业务。"""
    try:
        line = "%s\tok=%s\t%s\t%s\n" % (
            time.strftime("%Y-%m-%d %H:%M:%S"),
            ok,
            note,
            raw[:4096].decode("ascii", "replace"),
        )
        with open(X402_LOG, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:  # noqa: BLE001
        pass


class X402Gate:
    """纯 ASGI 中间件:未带支付凭证 → 402;带凭证 → 影子验签记档后放行。
    纯 ASGI(不继承 BaseHTTPMiddleware)以免缓冲破坏 MCP 的 SSE 流。"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # 对 /mcp 的 GET(SSE 探测)与 POST(JSON-RPC)都设 402 闸;OPTIONS 等放行
        if scope.get("type") == "http" and scope.get("method") in ("GET", "POST"):
            headers = dict(scope.get("headers") or [])
            raw = _extract_payment(headers)
            if raw is None:
                await _send_402(send, scope)
                return
            ok, note = _shadow_verify(raw)
            _log_sample(raw, ok, note)
            if X402_ENFORCE and not ok:
                await _send_402(send, scope)
                return
        await self.app(scope, receive, send)


if __name__ == "__main__":
    # MCP over Streamable HTTP + x402 支付网关中间件;由 nginx 反代到 https://.../mcp
    import uvicorn
    from starlette.middleware import Middleware

    app = mcp.http_app(path="/mcp", middleware=[Middleware(X402Gate)])
    uvicorn.run(app, host="127.0.0.1", port=8100, log_level="info")

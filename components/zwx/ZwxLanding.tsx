"use client";

// 紫微星海 · 落地页(2026-07 重设计拍板稿)
// The form sends birth details once to the same-origin state endpoint, then
// continues with an encrypted report URL instead of a public query string.
import { useEffect, useRef, useState, type FormEvent } from "react";
import PrivacyCleanup from "@/components/PrivacyCleanup";
import "./zwx.css";

/* ============ 静态数据(全部可确定性渲染,避免水合不一致) ============ */
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GU = ["夜半", "鸡鸣", "平旦", "日出", "食时", "隅中", "日中", "日昳", "晡时", "日入", "黄昏", "人定"];
const GLOSS = [
  "万籁俱寂,一阳初生。", "鸡声未动,梦在最深处。", "夜与昼交,天光将启。", "日破云出,万物初醒。",
  "朝食既毕,人间烟火起。", "阳气渐盛,万事可为。", "日悬中天,光盛之极。", "日过中天,光影西斜。",
  "晡食之时,倦鸟知还。", "日落西山,暮色四合。", "灯火初上,昼夜交班。", "夜阑人定,星河始明。",
];
const rangeOf = (i: number) => {
  const s = (23 + i * 2) % 24, e = (s + 2) % 24, p = (n: number) => String(n).padStart(2, "0");
  return `${p(s)}:00 — ${p(e)}:00`;
};
const warmOf = (i: number) => (Math.cos((i - 6) * Math.PI / 6) + 1) / 2; // 午最暖,子最深

const polar = (cx: number, cy: number, r: number, aDeg: number): [number, number] => {
  const a = (aDeg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
// 时辰环扇区(190,190 圆心,内 100 外 170)
const WEDGES = ZHI.map((z, i) => {
  const mid = i * 30, a0 = mid - 13, a1 = mid + 13, cx = 190, cy = 190, r0 = 100, r1 = 170;
  const P = (a: number, r: number) => polar(cx, cy, r, a).map((v) => v.toFixed(1)).join(" ");
  const [lx, ly] = polar(cx, cy, 136, mid);
  return {
    z, i,
    d: `M${P(a0, r1)} A ${r1} ${r1} 0 0 1 ${P(a1, r1)} L ${P(a1, r0)} A ${r0} ${r0} 0 0 0 ${P(a0, r0)} Z`,
    lx: lx.toFixed(1), ly: (ly + 7).toFixed(1),
  };
});
// 十二维雷达(真实维度,四域着色)
const DIMS: [string, string][] = [
  ["野心与进取", "#d9b26c"], ["关系警觉", "#d98a97"], ["自主与空间需求", "#a98fd6"],
  ["社交开放度", "#7fa9d9"], ["信任建立速度", "#d98a97"], ["情感依赖倾向", "#d98a97"],
  ["承诺与责任感", "#d9b26c"], ["浪漫主动性", "#7fa9d9"], ["共情与体察", "#7fa9d9"],
  ["压力韧性", "#d9b26c"], ["冲突表达方式", "#a98fd6"], ["新鲜感需求", "#a98fd6"],
];
const DIM_VALS = [62, 55, 71, 48, 44, 58, 80, 52, 67, 73, 46, 60];
const RADAR = DIMS.map(([label, color], i) => {
  const a = i * 30;
  const [sx, sy] = polar(260, 260, 170, a);
  const [dx, dy] = polar(260, 260, DIM_VALS[i] / 100 * 170, a);
  const [lx, ly] = polar(260, 260, 194, a);
  const cos = Math.cos((a - 90) * Math.PI / 180);
  return {
    label, color,
    spoke: { x2: sx.toFixed(1), y2: sy.toFixed(1) },
    dot: { cx: dx.toFixed(1), cy: dy.toFixed(1) },
    lbl: { x: lx.toFixed(1), y: (ly + 4).toFixed(1), anchor: (Math.abs(cos) < .3 ? "middle" : cos > 0 ? "start" : "end") as "middle" | "start" | "end" },
  };
});
const RADAR_POLY = DIMS.map((_, i) => polar(260, 260, DIM_VALS[i] / 100 * 170, i * 30).map((v) => v.toFixed(1)).join(",")).join(" ");
// 八卦爻符(乾兑离震巽坎艮坤,自下而上)
const GUA = [[1, 1, 1], [1, 1, 0], [1, 0, 1], [1, 0, 0], [0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 0, 0]];

export default function ZwxLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const warmRef = useRef(warmOf(5));

  const [selIdx, setSelIdx] = useState(5);            // 默认巳时
  const [ziMode, setZiMode] = useState<"early" | "late">("early"); // 子时:早子 00-01 / 夜子 23-24
  const [calType, setCalType] = useState<"solar" | "lunar">("solar");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [isLeap, setIsLeap] = useState(false);
  const [uname, setUname] = useState("");
  const [yy, setYy] = useState("1995");
  const [mm, setMm] = useState("11");
  const [dd, setDd] = useState("23");
  const [navSolid, setNavSolid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const hourValue = selIdx === 0 ? (ziMode === "late" ? 23 : 0) : selIdx * 2;

  const submitBirth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/report-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth: {
            name: uname.trim() || "我",
            year: Number(yy), month: Number(mm), day: Number(dd), hour: hourValue, minute: 0,
            gender, calendarType: calType, isLeapMonth: calType === "lunar" && isLeap,
          },
        }),
      });
      const data = await response.json() as { state?: string; error?: string };
      if (!response.ok || !data.state) throw new Error(data.error || "无法创建报告，请稍后重试。");
      window.location.assign(`/?state=${encodeURIComponent(data.state)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "无法创建报告，请稍后重试。");
      setSubmitting(false);
    }
  };

  const chooseShichen = (i: number) => {
    setSelIdx(i);
    warmRef.current = warmOf(i);
  };

  /* ---------- 星云流体(WebGL,天色随时辰) ---------- */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const gl = cv.getContext("webgl");
    if (!gl) return;
    const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const FS = `precision highp float;uniform float t;uniform vec2 r;uniform vec2 m;uniform float hw;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.1+vec2(1.7,9.2);a*=.55;}return v;}
void main(){vec2 uv=(gl_FragCoord.xy*2.-r)/min(r.x,r.y);
vec2 q=vec2(fbm(uv+t*.04),fbm(uv+vec2(5.2,1.3)-t*.03));
vec2 w=vec2(fbm(uv+3.*q+vec2(1.7,9.2)+t*.05),fbm(uv+3.*q+vec2(8.3,2.8)-t*.04));
float f=fbm(uv+3.*w+(m-.5)*.6);
vec3 col=mix(vec3(.05,.045,.115),vec3(.20,.16,.44),clamp(f*f*2.2,0.,1.));
col=mix(col,vec3(.13,.23,.48),pow(clamp(q.y*f,0.,1.),2.)*(1.-hw*.5));
col=mix(col,vec3(.90,.74,.46),pow(clamp(w.x*f,0.,1.),3.2)*(.5+hw*.5));
col+=vec3(.05,.03,0.)*hw*f;
float d=length(uv)*.55;col*=1.-d*d*.36;
gl_FragColor=vec4(col,1.);}`;
    const sh = (ty: number, src: string) => { const s = gl.createShader(ty)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const lp = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
    const ut = gl.getUniformLocation(pr, "t"), ur = gl.getUniformLocation(pr, "r"),
      um = gl.getUniformLocation(pr, "m"), uw = gl.getUniformLocation(pr, "hw");
    let mx = .5, my = .5, tx = .5, ty2 = .5, warmC = warmRef.current, raf = 0, dead = false;
    const onMove = (e: MouseEvent) => { tx = e.clientX / innerWidth; ty2 = 1 - e.clientY / innerHeight; };
    addEventListener("mousemove", onMove, { passive: true });
    const rs = () => {
      const d = Math.min(devicePixelRatio, 1.5);
      cv.width = innerWidth * d * .6; cv.height = innerHeight * d * .6;
      gl.viewport(0, 0, cv.width, cv.height);
    };
    rs(); addEventListener("resize", rs);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fr = (ts: number) => {
      if (dead) return;
      mx += (tx - mx) * .05; my += (ty2 - my) * .05; warmC += (warmRef.current - warmC) * .02;
      gl.uniform1f(ut, ts * .001); gl.uniform2f(ur, cv.width, cv.height);
      gl.uniform2f(um, mx, my); gl.uniform1f(uw, warmC);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!still) raf = requestAnimationFrame(fr);
    };
    raf = requestAnimationFrame(fr);
    return () => { dead = true; cancelAnimationFrame(raf); removeEventListener("mousemove", onMove); removeEventListener("resize", rs); };
  }, []);

  /* ---------- 星野:散星 + 银河星流 + 亮星(含随机,只在客户端生成) ---------- */
  useEffect(() => {
    const box = starsRef.current;
    if (!box || box.childElementCount) return;
    const NSVG = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NSVG, "svg");
    svg.setAttribute("viewBox", "0 0 1600 900");
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.innerHTML = '<defs><filter id="zxStGlow" x="-200%" y="-200%" width="500%" height="500%">' +
      '<feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    const star = (x: number, y: number, r: number, fill: string, glow: boolean, twinkle: boolean) => {
      const c = document.createElementNS(NSVG, "circle");
      c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("r", r.toFixed(2)); c.setAttribute("fill", fill);
      if (glow) c.setAttribute("filter", "url(#zxStGlow)");
      if (twinkle) {
        c.setAttribute("class", "zx-tw");
        c.style.setProperty("--d", (3 + Math.random() * 5).toFixed(1) + "s");
        c.style.animationDelay = (-Math.random() * 8).toFixed(1) + "s";
      }
      svg.appendChild(c);
    };
    for (let i = 0; i < 190; i++)
      star(Math.random() * 1600, Math.random() * 900, Math.random() * 1.2 + .3, Math.random() < .2 ? "#e8ce9a" : "#cfd6ea", false, true);
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    for (let i = 0; i < 340; i++) {
      const t = Math.random(), bx = -100 + t * 1800, by = 620 - t * 460, off = gauss() * 95;
      star(bx + off * .41, by + off * .91, Math.random() * .9 + .25,
        Math.random() < .24 ? "#efdcb2" : "#dde3f5", Math.random() < .08, Math.random() < .5);
    }
    ([[300, 170], [1180, 220], [760, 420], [1420, 560], [190, 640], [980, 120]] as const).forEach(([x, y]) => {
      const g = document.createElementNS(NSVG, "g");
      const len = 9 + Math.random() * 7;
      g.innerHTML = `<line x1="${x - len}" y1="${y}" x2="${x + len}" y2="${y}" stroke="rgba(223,230,250,.55)" stroke-width=".8"/>` +
        `<line x1="${x}" y1="${y - len}" x2="${x}" y2="${y + len}" stroke="rgba(223,230,250,.55)" stroke-width=".8"/>`;
      svg.appendChild(g);
      star(x, y, 1.9, "#f2f4ff", true, true);
    });
    box.appendChild(svg);
  }, []);

  /* ---------- 滚动显影 + 指标/称重条生长 + 导航吸底 ---------- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const rev = new IntersectionObserver((es) => {
      es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("zx-in"); rev.unobserve(en.target); } });
    }, { threshold: .12 });
    root.querySelectorAll(".zx-rv").forEach((el) => rev.observe(el));
    const grow = new IntersectionObserver((es) => {
      es.forEach((en) => {
        if (!en.isIntersecting) return;
        const fill = en.target.querySelector<HTMLElement>(".zx-mfill,.zx-wxfill");
        if (fill) fill.style.width = (en.target as HTMLElement).dataset.val + "%";
        grow.unobserve(en.target);
      });
    }, { threshold: .4 });
    root.querySelectorAll("[data-val]").forEach((el) => grow.observe(el));
    const onScroll = () => setNavSolid(scrollY > 40);
    addEventListener("scroll", onScroll, { passive: true });
    return () => { rev.disconnect(); grow.disconnect(); removeEventListener("scroll", onScroll); };
  }, []);

  const years: number[] = [];
  for (let y = 1900; y <= 2025; y++) years.push(y);

  return (
    <>
    <PrivacyCleanup />
    <div className="zwx" ref={rootRef}>
      <canvas className="zx-fluid" ref={canvasRef} />
      <div className="zx-galaxy" aria-hidden="true" />
      <div className="zx-stars" ref={starsRef} />
      <div className="zx-vig" />
      <div className="zx-grain" />

      <div className="zx-wrap">

        {/* ============ 导航 ============ */}
        <nav className={`zx-nav${navSolid ? " zx-solid" : ""}`}>
          <a className="zx-brand" href="#top"><b>FATE°</b><span>东方命理</span></a>
          <div className="zx-links">
            <a href="#top">缘起</a><a href="#qipan">起盘</a><a href="#mingjian">命鉴</a><a href="#mulu">目录</a><a href="#fa">推演</a>
          </div>
          <a className="zx-navcta" href="#qipan">生成报告</a>
        </nav>

        {/* ============ HERO ============ */}
        <header className="zx-hero" id="top">
          <div className="zx-moon" aria-hidden="true" />
          <span className="zx-meteor" style={{ top: "12%", right: "6%", "--mt": "9s", "--md": "1s" } as React.CSSProperties} aria-hidden="true" />
          <span className="zx-meteor" style={{ top: "5%", right: "34%", "--mt": "13s", "--md": "5s" } as React.CSSProperties} aria-hidden="true" />
          <span className="zx-meteor" style={{ top: "26%", right: "14%", "--mt": "17s", "--md": "8s" } as React.CSSProperties} aria-hidden="true" />
          <span className="zx-meteor" style={{ top: "8%", right: "56%", "--mt": "15s", "--md": "3.5s" } as React.CSSProperties} aria-hidden="true" />
          <span className="zx-meteor" style={{ top: "38%", right: "4%", "--mt": "19s", "--md": "11s" } as React.CSSProperties} aria-hidden="true" />
          <span className="zx-meteor" style={{ top: "17%", right: "72%", "--mt": "21s", "--md": "14s" } as React.CSSProperties} aria-hidden="true" />
          <span className="zx-meteor" style={{ top: "3%", right: "18%", "--mt": "12s", "--md": "6.5s" } as React.CSSProperties} aria-hidden="true" />
          <div className="zx-hring" aria-hidden="true">
            <svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <path id="zxCir252" d="M300 48 a252 252 0 1 1 -0.02 0" />
                <path id="zxCir185" d="M300 115 a185 185 0 1 1 -0.02 0" />
                <radialGradient id="zxCglow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(232,206,154,.14)" />
                  <stop offset="100%" stopColor="rgba(232,206,154,0)" />
                </radialGradient>
              </defs>
              <circle cx="300" cy="300" r="120" fill="url(#zxCglow)" />
              <g className="zx-rot">
                <circle cx="300" cy="300" r="290" fill="none" stroke="rgba(232,206,154,.22)" strokeWidth="1" />
                <circle cx="300" cy="300" r="279" fill="none" stroke="rgba(232,206,154,.3)" strokeWidth="9"
                  pathLength={360} strokeDasharray=".45 2.55" opacity=".38" />
                <text fontSize="13" letterSpacing="15" fill="rgba(232,206,154,.5)">
                  <textPath href="#zxCir252">角·亢·氐·房·心·尾·箕·斗·牛·女·虚·危·室·壁·奎·娄·胃·昴·毕·觜·参·井·鬼·柳·星·张·翼·轸</textPath>
                </text>
              </g>
              <g className="zx-rot zx-rev">
                <circle cx="300" cy="300" r="232" fill="none" stroke="rgba(232,206,154,.16)" strokeWidth="1" />
                <circle cx="300" cy="300" r="224" fill="none" stroke="rgba(232,206,154,.3)" strokeWidth="6"
                  pathLength={360} strokeDasharray=".3 1.2" opacity=".28" />
                <text fontSize="16" letterSpacing="100" fill="rgba(179,173,196,.6)">
                  <textPath href="#zxCir185">甲乙丙丁戊己庚辛壬癸</textPath>
                </text>
              </g>
              <g className="zx-rot zx-mid">
                <circle cx="300" cy="300" r="150" fill="none" stroke="rgba(232,206,154,.25)" strokeWidth="1" strokeDasharray="2 7" />
                <g fill="rgba(232,206,154,.55)">
                  {GUA.map((tr, i) => (
                    <g key={i} transform={`rotate(${i * 45} 300 300) translate(300 165)`}>
                      {tr.map((solid, j) => {
                        const y = (2 - j) * 7 - 8;
                        return solid
                          ? <rect key={j} x={-13} y={y} width={26} height={2.4} />
                          : <g key={j}><rect x={-13} y={y} width={10.5} height={2.4} /><rect x={2.5} y={y} width={10.5} height={2.4} /></g>;
                      })}
                    </g>
                  ))}
                </g>
              </g>
              <g fontFamily="Kaiti SC,KaiTi,STKaiti,serif" fontSize="13" fill="rgba(232,206,154,.55)" textAnchor="middle">
                <text x="300" y="98">玄武</text>
                <text x="300" y="512">朱雀</text>
                <text x="509" y="305">青龙</text>
                <text x="91" y="305">白虎</text>
              </g>
              <circle cx="300" cy="300" r="58" fill="none" stroke="rgba(232,206,154,.28)" strokeWidth="1" />
              <line x1="300" y1="272" x2="300" y2="328" stroke="rgba(232,206,154,.3)" strokeWidth="1" />
              <line x1="272" y1="300" x2="328" y2="300" stroke="rgba(232,206,154,.3)" strokeWidth="1" />
              <path d="M300 284 l3.4 12.6 L316 300 l-12.6 3.4 L300 316 l-3.4 -12.6 L284 300 l12.6 -3.4 Z" fill="rgba(232,206,154,.9)" />
              <text x="300" y="348" textAnchor="middle" fontSize="13" letterSpacing="6" fill="rgba(232,206,154,.7)">紫微垣</text>
            </svg>
          </div>

          <div className="zx-hero-inner">
            <div className="zx-eyebrow">EASTERN PERSONA MODELING · 紫微星海</div>
            <h1>星垂万古,<br /><span className="zx-g">照见一人。</span></h1>
            <p className="zx-lead">八字为经,星宿为纬。FATE° 以东方命理为骨、FATE 模型 2.0 为算,潜入紫微星海,为你织就一册读得进去、也读得懂你的深度人格命书。</p>
            <div className="zx-ctarow">
              <a className="zx-btn" href="#qipan">生成我的报告<span className="zx-badge">公测限免</span></a>
              <a className="zx-more" href="#mingjian">先读样章 ↓</a>
            </div>
          </div>

          <svg className="zx-dipper" viewBox="0 0 320 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <line x1="80" y1="115" x2="58" y2="28" stroke="rgba(232,206,154,.3)" strokeDasharray="3 5" />
            <polyline points="80,115 95,175 155,182 160,120 80,115" stroke="rgba(232,206,154,.32)" fill="none" />
            <polyline points="160,120 210,125 252,143 288,175" stroke="rgba(232,206,154,.32)" fill="none" />
            <circle className="zx-pol" cx="58" cy="28" r="3" />
            <circle cx="80" cy="115" r="2.2" fill="#cfd6ea" /><circle cx="95" cy="175" r="2.2" fill="#cfd6ea" />
            <circle cx="155" cy="182" r="2" fill="#cfd6ea" /><circle cx="160" cy="120" r="2" fill="#cfd6ea" />
            <circle cx="210" cy="125" r="2.2" fill="#cfd6ea" /><circle cx="252" cy="143" r="2" fill="#cfd6ea" />
            <circle cx="288" cy="175" r="2.4" fill="#cfd6ea" />
            <text x="70" y="16">勾陈一 · 北极</text>
            <text x="62" y="110">天枢</text><text x="76" y="192">天璇</text><text x="148" y="199">天玑</text>
            <text x="152" y="112">天权</text><text x="203" y="117">玉衡</text><text x="247" y="162">开阳</text><text x="281" y="194">摇光</text>
          </svg>
          <div className="zx-hmeta">勾陈一 · RA 02H 31M · DEC +89°16′ —— <em>居其所,而众星共之</em></div>
          <div className="zx-scrollhint">顺流而下</div>
        </header>

        <div className="zx-deep">

          {/* ============ 壹 · 起盘(对接真实引擎) ============ */}
          <section id="qipan">
            <header className="zx-sech zx-rv">
              <div className="zx-secno">01 / QI PAN · 起盘</div>
              <h2>以生辰,叩星门</h2>
              <p className="zx-secsub">星海无言,须以来处相叩。落笔生辰,余下交给星轨。</p>
              <span className="zx-ghost">壹</span>
            </header>

            <form className="zx-form zx-corner zx-rv" onSubmit={submitBirth}>

              <div>
                <div className="zx-field">
                  <label htmlFor="zxName">名 讳</label>
                  <input id="zxName" type="text" placeholder="姓名或化名,报告扉页将以此相称"
                    autoComplete="off" maxLength={12} value={uname} onChange={(e) => setUname(e.target.value)} />
                </div>
                <div className="zx-field">
                  <label>历 法</label>
                  <div className="zx-seg">
                    <button type="button" className={calType === "solar" ? "zx-on" : ""} onClick={() => { setCalType("solar"); setIsLeap(false); }}>公历</button>
                    <button type="button" className={calType === "lunar" ? "zx-on" : ""} onClick={() => setCalType("lunar")}>农历</button>
                  </div>
                  {calType === "lunar" && (
                    <label className="zx-leap">
                      <input type="checkbox" checked={isLeap} onChange={(e) => setIsLeap(e.target.checked)} />
                      这个月是闰月
                    </label>
                  )}
                </div>
                <div className="zx-field">
                  <label>生 辰</label>
                  <div className="zx-row3">
                    <select aria-label="生年" value={yy} onChange={(e) => setYy(e.target.value)}>
                      {years.map((y) => <option key={y} value={y}>{y} 年</option>)}
                    </select>
                    <select aria-label="生月" value={mm} onChange={(e) => setMm(e.target.value)}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m} 月</option>)}
                    </select>
                    <select aria-label="生日" value={dd} onChange={(e) => setDd(e.target.value)}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d} 日</option>)}
                    </select>
                  </div>
                </div>
                <div className="zx-field">
                  <label>造 式</label>
                  <div className="zx-seg">
                    <button type="button" className={gender === "male" ? "zx-on" : ""} onClick={() => setGender("male")}>乾造 · 男</button>
                    <button type="button" className={gender === "female" ? "zx-on" : ""} onClick={() => setGender("female")}>坤造 · 女</button>
                  </div>
                </div>
                <div className="zx-submitrow">
                  <button className="zx-btn" type="submit" disabled={submitting}>{submitting ? "正在起盘…" : "生成我的报告"}</button>
                  <p className="zx-note">公测期间限免 · 生辰信息仅用于本次演算 · 秒出画像</p>
                  {submitError && <p className="zx-note" role="alert">{submitError}</p>}
                </div>
              </div>

              <figure className="zx-scbox">
                <svg className="zx-ring" viewBox="0 0 380 380" xmlns="http://www.w3.org/2000/svg" aria-label="十二时辰选择环">
                  <g className="zx-rot zx-mid" opacity=".55">
                    <circle cx="190" cy="190" r="178" fill="none" stroke="rgba(232,206,154,.3)" strokeWidth="5"
                      pathLength={360} strokeDasharray=".4 2.6" />
                  </g>
                  <circle cx="190" cy="190" r="92" fill="none" stroke="rgba(232,206,154,.22)" strokeWidth="1" strokeDasharray="2 6" />
                  <g className="zx-needle" style={{ transform: `rotate(${selIdx * 30}deg)` }} aria-hidden="true">
                    <path d="M190 96 l4.5 15 L190 158 l-4.5 -47 Z" fill="rgba(232,206,154,.8)" />
                    <circle cx="190" cy="96" r="2.6" fill="#f2e2be" />
                  </g>
                  <g>
                    {WEDGES.map((w) => (
                      <g key={w.z}>
                        <path d={w.d} className={`zx-wg${selIdx === w.i ? " zx-sel" : ""}`} tabIndex={0} role="button"
                          aria-label={`${w.z}时 ${GU[w.i]} ${rangeOf(w.i)}`}
                          onClick={() => chooseShichen(w.i)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseShichen(w.i); } }} />
                        <text x={w.lx} y={w.ly} textAnchor="middle" className={`zx-zi${selIdx === w.i ? " zx-sel" : ""}`}>{w.z}</text>
                      </g>
                    ))}
                  </g>
                  <text className="zx-stag" x="190" y="146" textAnchor="middle">时 辰</text>
                  <text className="zx-schar" x="190" y="198" textAnchor="middle">{ZHI[selIdx]}时</text>
                  <text className="zx-sgu" x="190" y="224" textAnchor="middle">古称 · {GU[selIdx]}</text>
                  <text className="zx-srange" x="190" y="248" textAnchor="middle">{selIdx === 0 ? (ziMode === "late" ? "23:00 — 24:00" : "00:00 — 01:00") : rangeOf(selIdx)}</text>
                </svg>
                {selIdx === 0 && (
                  <div className="zx-zimode">
                    <div className="zx-seg">
                      <button type="button" className={ziMode === "early" ? "zx-on" : ""} onClick={() => setZiMode("early")}>早子 00–01</button>
                      <button type="button" className={ziMode === "late" ? "zx-on" : ""} onClick={() => setZiMode("late")}>夜子 23–24</button>
                    </div>
                  </div>
                )}
                <figcaption>
                  <em>{GLOSS[selIdx]}</em>
                  <small>指尖轻点,取一个时辰 —— 天色随之</small>
                </figcaption>
              </figure>
            </form>
          </section>

          <div className="zx-orn"><i></i></div>

          {/* ============ 贰 · 命鉴(样章) ============ */}
          <section id="mingjian">
            <header className="zx-sech zx-rv">
              <div className="zx-secno">02 / MING JIAN · 命鉴</div>
              <h2>样章 · 一册命书的模样</h2>
              <p className="zx-secsub">以一位乙亥年生人为样。你的一册,将由你的生辰重新演算。</p>
              <span className="zx-ghost">贰</span>
            </header>

            {/* 人设卡 */}
            <div className="zx-panel zx-corner zx-persona zx-rv">
              <div>
                <div className="zx-plabel">PERSONA / 命主人设</div>
                <h3>「在秩序里深耕,<br />在人群中充电的人。」</h3>
                <div className="zx-pills">
                  <span className="zx-pill">稳定供电型</span>
                  <span className="zx-pill">顺其自然派</span>
                  <span className="zx-pill">规则里的稳手</span>
                </div>
                <p className="zx-pmeta"><b>日主戊土</b> · 印星贴身 · 火土相生 —— 样章命主 乙亥年生人 · 演算于丙午年夏</p>
              </div>
              <div className="zx-sealbox">
                <svg className="zx-seal" width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="90" height="90" rx="10" fill="#ad4330" />
                  <rect x="9.5" y="9.5" width="77" height="77" rx="6" fill="none" stroke="rgba(255,240,230,.8)" strokeWidth="1.4" />
                  <g fontFamily="Kaiti SC,KaiTi,STKaiti,serif" fontSize="30" fill="#f7ece2" textAnchor="middle">
                    <text x="68" y="43">紫</text><text x="68" y="80">微</text>
                    <text x="28" y="43">命</text><text x="28" y="80">鑑</text>
                  </g>
                </svg>
                <small>印 · 紫微命鑑</small>
              </div>
            </div>

            {/* 四柱 */}
            <div className="zx-panel zx-corner zx-rv">
              <div className="zx-pzhead">
                <h4>四柱排盘</h4>
                <span>SI ZHU / FOUR PILLARS · 干支五行着色</span>
              </div>
              <div className="zx-pillars">
                <div className="zx-pillar">
                  <div className="zx-plh">年柱<i>YEAR</i></div>
                  <div className="zx-plgod">正官</div>
                  <div className="zx-plchar wood">乙<i>木</i></div><br />
                  <div className="zx-plchar water">亥<i>水</i></div>
                  <div className="zx-plgod">偏财</div>
                  <div className="zx-plhid">藏干 · 壬甲</div>
                  <div className="zx-plnayin">纳音 · 山头火</div>
                </div>
                <div className="zx-pillar">
                  <div className="zx-plh">月柱<i>MONTH</i></div>
                  <div className="zx-plgod">正印</div>
                  <div className="zx-plchar fire">丁<i>火</i></div><br />
                  <div className="zx-plchar water">亥<i>水</i></div>
                  <div className="zx-plgod">偏财</div>
                  <div className="zx-plhid">藏干 · 壬甲</div>
                  <div className="zx-plnayin">纳音 · 屋上土</div>
                </div>
                <div className="zx-pillar">
                  <div className="zx-plh">日柱<i>DAY</i></div>
                  <div className="zx-plgod">日元</div>
                  <div className="zx-plchar earth">戊<i>土</i></div><br />
                  <div className="zx-plchar fire">午<i>火</i></div>
                  <div className="zx-plgod">正印</div>
                  <div className="zx-plhid">藏干 · 丁己</div>
                  <div className="zx-plnayin">纳音 · 天上火</div>
                </div>
                <div className="zx-pillar">
                  <div className="zx-plh">时柱<i>HOUR</i></div>
                  <div className="zx-plgod">正印</div>
                  <div className="zx-plchar fire">丁<i>火</i></div><br />
                  <div className="zx-plchar fire">巳<i>火</i></div>
                  <div className="zx-plgod">偏印</div>
                  <div className="zx-plhid">藏干 · 丙庚戊</div>
                  <div className="zx-plnayin">纳音 · 沙中土</div>
                </div>
              </div>
            </div>

            {/* 五行称重 */}
            <div className="zx-panel zx-corner zx-rv">
              <div className="zx-pzhead">
                <h4>五行称重</h4>
                <span>WU XING WEIGHTS · 全盘干支称重,归一为百分</span>
              </div>
              {/* 数值 = 引擎对 1995-11-23 巳时的真实输出(见 tests/_verdict_check,火土同宫版),不得手编;中和盘不设喜忌 */}
              {([
                ["water", "水", "WATER", 33.7, ""],
                ["fire", "火", "FIRE", 29, ""],
                ["wood", "木", "WOOD", 22.1, ""],
                ["earth", "土", "EARTH", 11.3, ""],
                ["metal", "金", "METAL", 3.8, ""],
              ] as [string, string, string, number, string][]).map(([el, zh, en, val, flag]) => (
                <div className="zx-wx" data-val={val} key={el}>
                  <span className={`zx-wxel ${el}`}>{zh}<i>{en}</i></span>
                  <div className="zx-wxtrack">
                    <i className="zx-wxfill" style={{ background: `linear-gradient(90deg,rgba(232,206,154,.12),var(--zx-${el}))` }} />
                  </div>
                  <span className="zx-wxval">{val}%{flag === "xi" && <i className="zx-xi">喜</i>}{flag === "ji" && <i className="zx-ji">忌</i>}</span>
                </div>
              ))}
              <p className="zx-wxnote"><b>日主戊土,生于亥月</b>——水当令而禄刃有根,判中和。每一分都由 FATE 模型 2.0 对干支、藏干、季节逐项称重而来,有出处,可复核。</p>
            </div>

            {/* 十二维雷达 */}
            <div className="zx-panel zx-corner zx-rv">
              <div className="zx-pzhead">
                <h4>十二维深度画像</h4>
                <span>TWELVE DIMENSIONS · 四域十二维,维维有出处</span>
              </div>
              <div className="zx-radarwrap">
                <svg className="zx-radar" viewBox="0 0 520 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="十二维雷达图">
                  {[42.5, 85, 127.5, 170].map((r) => <circle key={r} className="zx-gridc" cx="260" cy="260" r={r} />)}
                  {RADAR.map((d, i) => <line key={i} className="zx-spoke" x1="260" y1="260" x2={d.spoke.x2} y2={d.spoke.y2} />)}
                  <polygon className="zx-poly" points={RADAR_POLY} />
                  {RADAR.map((d, i) => <circle key={i} cx={d.dot.cx} cy={d.dot.cy} r="3.4" fill={d.color} />)}
                  {RADAR.map((d, i) => (
                    <text key={i} className="zx-lbl" x={d.lbl.x} y={d.lbl.y} textAnchor={d.lbl.anchor}>{d.label}</text>
                  ))}
                </svg>
                <div className="zx-radarside">
                  <p>十二个维度不是拍脑袋——每一维都由十神、五行与结构信号推导而来。完整版一维一页:分值、关键词、推导逻辑、反向信号,以及感情/人际/压力三个情境下的你。</p>
                  <div className="zx-legend">
                    <span><i style={{ background: "#d9b26c" }} />成长与行动</span>
                    <span><i style={{ background: "#d98a97" }} />亲密与安全</span>
                    <span><i style={{ background: "#a98fd6" }} />边界与冲突</span>
                    <span><i style={{ background: "#7fa9d9" }} />沟通与连接</span>
                  </div>
                  <p className="zx-radarnote">样例分值 · 分数经 2500 盘常模校准,读倾向不读高下</p>
                </div>
              </div>
            </div>

            {/* 四章 */}
            <div className="zx-chapters">
              <article className="zx-chap zx-chap-love zx-rv">
                <div className="zx-no">卷一 · 感情</div>
                <h5>情缘篇</h5>
                <div className="zx-en">BOND</div>
                <svg className="zx-ast" viewBox="0 0 100 48"><polyline points="8,36 30,20 52,30 78,12 92,26" /><circle cx="8" cy="36" r="2" /><circle cx="30" cy="20" r="2.4" /><circle cx="52" cy="30" r="2" /><circle cx="78" cy="12" r="2.4" /><circle cx="92" cy="26" r="2" /></svg>
                <div className="zx-pills"><span className="zx-pill">重仪式感的人</span><span className="zx-pill">被追才有感觉</span></div>
                <p className="zx-quote">仪式感于你不是排场,是把日子过成有回声的证据;心意须先递到面前,你的火才肯点着。</p>
              </article>
              <article className="zx-chap zx-chap-path zx-rv" style={{ "--rd": ".12s" } as React.CSSProperties}>
                <div className="zx-no">卷二 · 事业</div>
                <h5>行路篇</h5>
                <div className="zx-en">PATH</div>
                <svg className="zx-ast" viewBox="0 0 100 48"><polyline points="6,40 28,30 46,34 68,16 92,8" /><circle cx="6" cy="40" r="2" /><circle cx="28" cy="30" r="2" /><circle cx="46" cy="34" r="2.4" /><circle cx="68" cy="16" r="2" /><circle cx="92" cy="8" r="2.6" /></svg>
                <div className="zx-pills"><span className="zx-pill">机会嗅觉型</span><span className="zx-pill">资源整合型</span></div>
                <p className="zx-quote">风未起时先闻其向;把散落的人与事拢成一股绳,是你的看家本事。</p>
              </article>
              <article className="zx-chap zx-chap-circle zx-rv">
                <div className="zx-no">卷三 · 人际</div>
                <h5>知己篇</h5>
                <div className="zx-en">CIRCLE</div>
                <svg className="zx-ast" viewBox="0 0 100 48"><polyline points="14,14 34,10 40,32 18,36 14,14" /><line x1="40" y1="32" x2="78" y2="22" strokeDasharray="3 4" /><circle cx="14" cy="14" r="2" /><circle cx="34" cy="10" r="2" /><circle cx="40" cy="32" r="2.4" /><circle cx="18" cy="36" r="2" /><circle cx="78" cy="22" r="2" /></svg>
                <div className="zx-pills"><span className="zx-pill">小圈子深交型</span></div>
                <p className="zx-quote">热闹处你多半只是路过;三五知己的桌上,你才真正落座。</p>
              </article>
              <article className="zx-chap zx-chap-tide zx-rv" style={{ "--rd": ".12s" } as React.CSSProperties}>
                <div className="zx-no">卷四 · 时运</div>
                <h5>潮汐篇</h5>
                <div className="zx-en">TIDE</div>
                <svg className="zx-ast" viewBox="0 0 100 48"><polyline points="8,42 30,38 50,30 68,20 88,6" /><circle cx="8" cy="42" r="2" /><circle cx="30" cy="38" r="2" /><circle cx="50" cy="30" r="2" /><circle cx="68" cy="20" r="2" /><circle cx="88" cy="6" r="3" /></svg>
                <div className="zx-pills"><span className="zx-pill">蓄势型</span></div>
                <p className="zx-quote">眼下不是停滞,是弓在弦上;蓄下的每一分力,来年都算数。</p>
              </article>
            </div>

            {/* 指标五线 */}
            <div className="zx-panel zx-corner zx-rv">
              <div className="zx-pzhead">
                <h4>指标五线</h4>
                <span>INDICES · 常模为界,读的是倾向,不是高下</span>
              </div>
              {([
                ["秩序感", "日程即锚点,乱局中先立框。", 84, "--zx-gold2"],
                ["深耕力", "一件事,肯挖到十丈深。", 78, "--zx-earth"],
                ["机会嗅觉", "风起于青萍之末,你先知道。", 66, "--zx-wood"],
                ["社交电量", "电量有限,只供给真正要紧的人。", 42, "--zx-water"],
                ["冒险阈值", "不是不敢,是要先看清底牌。", 37, "--zx-fire"],
              ] as const).map(([nm, note, val, mc]) => (
                <div className="zx-metric" data-val={val} key={nm} style={{ "--mc": `var(${mc})` } as React.CSSProperties}>
                  <div className="zx-mtop"><span className="zx-mname">{nm}</span><span className="zx-mnote">{note}</span><span className="zx-mval">{val}</span></div>
                  <div className="zx-mtrack"><i className="zx-mfill" /><b className="zx-mmean" /></div>
                  <div className="zx-mscale"><span>0</span><span>25</span><span><em>50 · 常模</em></span><span>75</span><span>100</span></div>
                </div>
              ))}
            </div>

            {/* 专长天赋 */}
            <div className="zx-panel zx-corner zx-rv" style={{ padding: "54px 54px 44px" }}>
              <div className="zx-pzhead">
                <h4>专长天赋</h4>
                <span>APTITUDES · 四项天赋,各附命理出处</span>
              </div>
              <div className="zx-gifts">
                {([
                  ["玄学感知力", 78, "直觉捕捉型", "对隐喻、象征与他人未说出口的状态更敏锐——适合把直觉发展成可复盘的方法。"],
                  ["审美与创作灵感", 71, "氛围塑造型", "对氛围与形式有直觉,擅长把感受翻译成可看见的东西。"],
                  ["心动与吸引力", 64, "慢热蓄力型", "吸引力在熟悉之后才显形——不是没有火,是火候要到。"],
                  ["感情结构稳定度", 58, "需要磨合型", "有进入关系的能力,投入、表达与边界之间需要现实磨合。"],
                ] as const).map(([nm, val, tag, desc]) => (
                  <div className="zx-gift" key={nm}>
                    <h6>{nm}</h6>
                    <div className="zx-gval">{val}</div>
                    <div className="zx-gbar"><i style={{ width: `${val}%` }} /></div>
                    <span className="zx-gtag">{tag}</span>
                    <p>{desc}</p>
                  </div>
                ))}
              </div>
              <p className="zx-yearsnote">分数衡量倾向与敏锐度,不代表超自然能力 · 完整版逐项列出计分出处</p>
            </div>

            {/* 五年流年 */}
            <div className="zx-panel zx-corner zx-rv" style={{ padding: "54px 54px 44px" }}>
              <div className="zx-pzhead">
                <h4>五年流年</h4>
                <span>LIU NIAN · 2026 — 2030 · 只标节奏与倾向</span>
              </div>
              <div className="zx-years">
                {([
                  ["2026", [["丙", "fire"], ["午", "fire"]], "印星当值", "火借风势,学与名俱进——是把根扎深的一年。", ["进益", "蓄力"]],
                  ["2027", [["丁", "fire"], ["未", "earth"]], "印比相生", "有人递伞,也有人同行;合作里藏着你的加速度。", ["贵人", "合作"]],
                  ["2028", [["戊", "earth"], ["申", "metal"]], "食神吐秀", "憋了两年的东西终于有出口——作品会替你说话。", ["输出", "作品"]],
                  ["2029", [["己", "earth"], ["酉", "metal"]], "伤官见巧", "口才与锋芒并出,记得给表达装上闸门。", ["表达", "锋芒"]],
                  ["2030", [["庚", "metal"], ["戌", "earth"]], "食神坐库", "同行者众,分蛋糕前先谈好刀法。", ["合伙", "边界"]],
                ] as const).map(([yr, gz, god, txt, tags]) => (
                  <div className="zx-yr" key={yr}>
                    <div className="zx-ynum">{yr}</div>
                    <div className="zx-ygz">{gz.map(([c, el]) => <b className={el} key={c}>{c}</b>)}</div>
                    <div className="zx-ygod">{god}</div>
                    <p>{txt}</p>
                    <div className="zx-ytags">{tags.map((t) => <span key={t}>{t}</span>)}</div>
                  </div>
                ))}
              </div>
              <p className="zx-yearsnote">流年只标倾向与节奏,不作吉凶断言 · 完整版逐年附「宜留意」清单</p>
            </div>
          </section>

          <div className="zx-orn"><i></i></div>

          {/* ============ 叁 · 册内目录 ============ */}
          <section id="mulu">
            <header className="zx-sech zx-rv">
              <div className="zx-secno">03 / MU LU · 册内目录</div>
              <h2>一册两卷,三十余页</h2>
              <p className="zx-secsub">上卷谁都读得懂,下卷把算法摊开给你看。中英双语可选,PDF 成册交付。</p>
              <span className="zx-ghost">叁</span>
            </header>
            <div className="zx-tocgrid">
              <div className="zx-tocbook zx-corner zx-rv">
                <div className="zx-tvol"><b>上卷 · 结论</b><span>VOL.1 / CONCLUSIONS</span></div>
                <p className="zx-tsub">人人可读——判词、标签与白话长评,不带一个术语。</p>
                {([
                  ["综合评定", "人设判词 · 感情/事业/人际/时运四域标签 · 长评与建议", "页 01"],
                  ["流年大运", "本命结构 · 大运走势 · 今年流年 · 未来五年逐年拆解", "页 03"],
                ] as const).map(([nm, desc, pg]) => (
                  <div className="zx-titem" key={nm}>
                    <div><span className="zx-tname">{nm}</span><span className="zx-tdesc">{desc}</span></div>
                    <i className="zx-tdots" /><span className="zx-tpg">{pg}</span>
                  </div>
                ))}
                <div className="zx-twarn"><b>分卷页 —— </b>自此往后是底层算法逻辑:每一个结论怎么算出来的、每一分从哪里来。读懂需要一点命理基础,但正因为敢摊开,才值得信。</div>
              </div>
              <div className="zx-tocbook zx-corner zx-rv" style={{ "--rd": ".12s" } as React.CSSProperties}>
                <div className="zx-tvol"><b>下卷 · 推演</b><span>VOL.2 / DEEP ANALYSIS</span></div>
                <p className="zx-tsub">亮出算法——五行称重明细、判定阈值、每一分的出处。</p>
                {([
                  ["四柱命盘", "干支 · 藏干 · 十神 · 十二长生", "页 07"],
                  ["五行力量分布", "全盘称重明细,列出每一分的来源", "页 08"],
                  ["日主强弱判定", "判级理由 · 喜忌用神", "页 10"],
                  ["十神分布", "五局:秩序与边界 / 内在安全 / 关系投入 / 同伴与自主 / 表达与创造", "页 11"],
                  ["标签判定依据", "每一枚标签的指标数值与阈值刻度", "页 13"],
                  ["人格画像 · 行为模式", "主轴人格 · 复合人设 · 这张盘如何行动", "页 15"],
                  ["十二维深度画像", "一维一页:分值 / 关键词 / 推导逻辑 / 三情境洞察", "页 17"],
                  ["专长天赋", "四项天赋 · 各附计分出处与提醒", "页 29"],
                  ["免责声明", "仅供娱乐与自我认知参考", "页 33"],
                ] as const).map(([nm, desc, pg]) => (
                  <div className="zx-titem" key={nm}>
                    <div><span className="zx-tname">{nm}</span><span className="zx-tdesc">{desc}</span></div>
                    <i className="zx-tdots" /><span className="zx-tpg">{pg}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="zx-orn"><i></i></div>

          {/* ============ 肆 · 推演之法 ============ */}
          <section id="fa">
            <header className="zx-sech zx-rv">
              <div className="zx-secno">04 / FA · 推演之法</div>
              <h2>不测吉凶,只称重量</h2>
              <p className="zx-secsub">三步成书。每一步都有出处,每一分都可复核——这是我们与「忽悠」划清界限的方式。</p>
              <span className="zx-ghost">肆</span>
            </header>
            <div className="zx-steps">
              {([
                ["壹", "排 盘", "万年历定四柱,干支落位,分毫不差。农历闰月、真太阳时,皆有校订。", "CALENDAR → PILLARS", "0s"],
                ["贰", "称 权", "五行称重、日主强弱、十神落宫——每个字的力量逐项计分,归一成谱。", "WEIGHTS → SPINE", ".12s"],
                ["叁", "成 书", "以判词织章,四卷一册;指标读倾向,流年标节奏。只描摹,不断言。", "FATE MODEL 2.0 → BOOK", ".24s"],
              ] as const).map(([no, nm, txt, mono, rd]) => (
                <div className="zx-step zx-rv" key={no} style={{ "--rd": rd } as React.CSSProperties}>
                  <span className="zx-sno">{no}</span>
                  <h5>{nm}</h5>
                  <p>{txt}</p>
                  <div className="zx-smono">{mono}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ============ 尾部 CTA ============ */}
          <section className="zx-ctaband zx-rv">
            <h3>把你的生辰,交给星轨。</h3>
            <a className="zx-btn" href="#qipan">生成我的报告<span className="zx-badge">公测限免</span></a>
            <p className="zx-note">秒出画像 · 生辰信息仅用于本次演算</p>
          </section>

          {/* ============ 页脚 ============ */}
          <footer className="zx-foot">
            <div className="zx-footin">
              <div className="zx-fbrand">
                <b>FATE°</b>
                <span>EASTERN PERSONA MODELING</span>
                <p className="zx-fslogan">星垂万古,照见一人。</p>
              </div>
              <div>
                <h6>释 义</h6>
                <p>报告内容基于 FATE 模型 2.0 得出。</p>
                <p>仅供娱乐与自我认知参考,不作吉凶断言。</p>
                <p>生辰信息仅用于本次演算,不作他用。</p>
              </div>
              <div>
                <h6>导 航</h6>
                <a href="#top">缘起</a>
                <a href="#qipan">起盘</a>
                <a href="#mingjian">命鉴</a>
                <a href="#mulu">目录</a>
                <a href="#fa">推演</a>
              </div>
            </div>
            <div className="zx-footbtm">
              <span>© 2026 FATE° · 东方命理</span>
              <span>FATE-MODEL/2.0 · BUILD 紫微星海</span>
            </div>
          </footer>

        </div>
      </div>
    </div>
    </>
  );
}

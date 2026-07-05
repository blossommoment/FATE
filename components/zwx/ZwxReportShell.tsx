"use client";

// 紫微星海 · 结果页外壳:星空背景 + .zwxr 主题作用域。
// 只包壳,不碰 ResultContent 的任何数据与结构(换皮不动骨)。
// 阅读页不上 WebGL 流体——静态星空更利于长文阅读,也省电。
import { useEffect, useRef } from "react";
import "./zwx.css";
import "./zwxr.css";

export default function ZwxReportShell({ children }: { children: React.ReactNode }) {
  const starsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = starsRef.current;
    if (!box || box.childElementCount) return;
    const NSVG = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NSVG, "svg");
    svg.setAttribute("viewBox", "0 0 1600 900");
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    const star = (x: number, y: number, r: number, fill: string, twinkle: boolean) => {
      const c = document.createElementNS(NSVG, "circle");
      c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("r", r.toFixed(2)); c.setAttribute("fill", fill);
      if (twinkle) {
        c.setAttribute("class", "zx-tw");
        c.style.setProperty("--d", (3 + Math.random() * 5).toFixed(1) + "s");
        c.style.animationDelay = (-Math.random() * 8).toFixed(1) + "s";
      }
      svg.appendChild(c);
    };
    for (let i = 0; i < 150; i++)
      star(Math.random() * 1600, Math.random() * 900, Math.random() * 1.1 + .3,
        Math.random() < .2 ? "#e8ce9a" : "#cfd6ea", Math.random() < .6);
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    for (let i = 0; i < 200; i++) {
      const t = Math.random(), bx = -100 + t * 1800, by = 620 - t * 460, off = gauss() * 95;
      star(bx + off * .41, by + off * .91, Math.random() * .8 + .25,
        Math.random() < .24 ? "#efdcb2" : "#dde3f5", Math.random() < .4);
    }
    box.appendChild(svg);
  }, []);

  return (
    <div className="zwxr">
      <div className="zwxr-bg" aria-hidden="true" />
      <div className="zx-galaxy" aria-hidden="true" />
      <div className="zwxr-stars" ref={starsRef} aria-hidden="true" />
      <div className="zwxr-vig" aria-hidden="true" />
      <span className="zwxr-meteor" style={{ top: "8%", right: "10%", "--mt": "13s", "--md": "2s" } as React.CSSProperties} aria-hidden="true" />
      <span className="zwxr-meteor" style={{ top: "4%", right: "44%", "--mt": "17s", "--md": "7s" } as React.CSSProperties} aria-hidden="true" />
      <span className="zwxr-meteor" style={{ top: "22%", right: "24%", "--mt": "21s", "--md": "12s" } as React.CSSProperties} aria-hidden="true" />
      <span className="zwxr-meteor" style={{ top: "14%", right: "66%", "--mt": "15s", "--md": "4.5s" } as React.CSSProperties} aria-hidden="true" />
      <div className="zwxr-body">{children}</div>
      <div className="zwxr-brandmark" aria-hidden="true">
        <b>FATE° 东方人格建模</b>
        <span>ENGINE 2.0</span>
      </div>
    </div>
  );
}

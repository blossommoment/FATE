import type { CSSProperties } from "react";
import type { Elements } from "@/lib/types";

// 五行火焰：按木生火、火生土的相生次序排列，火焰高度与光晕代表加权占比。
const flameMeta: { key: keyof Elements; glyph: string; feeds: string; c1: string; c2: string; c3: string }[] = [
  { key: "wood", glyph: "木", feeds: "火", c1: "#eafff0", c2: "#4ade80", c3: "#15803d" },
  { key: "fire", glyph: "火", feeds: "土", c1: "#fff6d8", c2: "#fb923c", c3: "#dc2626" },
  { key: "earth", glyph: "土", feeds: "金", c1: "#ffedc7", c2: "#e3a857", c3: "#9a5b26" },
  { key: "metal", glyph: "金", feeds: "水", c1: "#ffffff", c2: "#f0cd6d", c3: "#b8860b" },
  { key: "water", glyph: "水", feeds: "木", c1: "#e6faff", c2: "#4cc9f0", c3: "#2554c7" },
];

export default function ElementFlames({ strength, counts }: { strength: Elements; counts: Elements }) {
  const dominantKey = flameMeta.reduce((best, item) => strength[item.key] > strength[best] ? item.key : best, flameMeta[0].key);
  return (
    <div className="element-flames" role="img" aria-label="五行能量火焰图，火焰越高代表该元素加权占比越高">
      {flameMeta.map((element, index) => {
        const value = strength[element.key];
        const intensity = Math.max(0.38, Math.min(1.22, 0.38 + value / 38 * 0.84));
        const cellState = `${element.key === dominantKey ? " dominant" : ""}${value < 7 ? " faint" : ""}`;
        return [
          <div
            className={`flame-cell flame-${element.key}${cellState}`}
            key={element.key}
            style={{ "--c1": element.c1, "--c2": element.c2, "--c3": element.c3, "--fi": intensity } as CSSProperties}
          >
            <div className="flame-stage">
              {element.key === dominantKey && <b className="flame-badge">旺</b>}
              <div className="flame"><i className="f-outer" /><i className="f-mid" /><i className="f-core" /></div>
              <span className="flame-glyph">{element.glyph}</span>
              <i className="flame-base" />
            </div>
            <div className="flame-meta">
              <strong>{Math.round(value)}<small>%</small></strong>
              <span>{element.glyph}生{element.feeds} · 原局 {counts[element.key]} 字</span>
            </div>
          </div>,
          index < flameMeta.length - 1
            ? <i className="sheng-arrow" key={`arrow-${element.key}`} aria-hidden="true"><small>生</small></i>
            : null,
        ];
      })}
    </div>
  );
}

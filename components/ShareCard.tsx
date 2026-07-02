"use client";

import { useState } from "react";

type Highlight = { label: string; score: number };

type Props = {
  userName: string;
  partnerName: string;
  userPillar: string;
  partnerPillar: string;
  score: number;
  headline: string;
  relationType: string;
  highlights: Highlight[];
};

// 用 canvas 在本机生成竖版分享图：不依赖服务端字体，也不产生任何网络请求。
export default function ShareCard(props: Props) {
  const [image, setImage] = useState<string | null>(null);

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const lines: string[] = [];
    let current = "";
    for (const char of text) {
      if (ctx.measureText(current + char).width > maxWidth) {
        lines.push(current);
        current = char;
      } else {
        current += char;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const generate = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 1160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const serif = "'Songti SC','SimSun',Georgia,serif";
    const mono = "'DM Mono','Courier New',monospace";

    ctx.fillStyle = "#f4f2ed";
    ctx.fillRect(0, 0, 750, 1160);
    ctx.strokeStyle = "#c8c5bd";
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 28, 694, 1104);
    ctx.strokeRect(36, 36, 678, 1088);

    ctx.textAlign = "left";
    ctx.fillStyle = "#111";
    ctx.font = `600 42px ${serif}`;
    ctx.fillText("FATE°", 64, 118);
    ctx.font = `20px ${mono}`;
    ctx.fillStyle = "#6d6b66";
    ctx.fillText(`${props.relationType.toUpperCase()} · 关系合盘`, 64, 152);

    ctx.textAlign = "center";
    ctx.fillStyle = "#111";
    ctx.font = `54px ${serif}`;
    ctx.fillText(`${props.userName} × ${props.partnerName}`, 375, 268);
    ctx.font = `24px ${mono}`;
    ctx.fillStyle = "#6d6b66";
    ctx.fillText(`${props.userPillar}日主 · ${props.partnerPillar}日主`, 375, 312);

    ctx.fillStyle = "#111";
    ctx.font = `300 216px ${mono}`;
    ctx.fillText(String(props.score), 375, 560);
    ctx.font = `22px ${mono}`;
    ctx.fillStyle = "#6d6b66";
    ctx.fillText("/ 100 契合指数", 375, 604);

    ctx.fillStyle = "#111";
    ctx.font = `34px ${serif}`;
    const headlineLines = wrapText(ctx, props.headline, 560);
    headlineLines.slice(0, 2).forEach((line, index) => ctx.fillText(line, 375, 688 + index * 50));

    const startY = 688 + Math.min(headlineLines.length, 2) * 50 + 40;
    ctx.strokeStyle = "#c8c5bd";
    ctx.beginPath();
    ctx.moveTo(120, startY - 24);
    ctx.lineTo(630, startY - 24);
    ctx.stroke();
    props.highlights.slice(0, 3).forEach((item, index) => {
      const y = startY + 22 + index * 58;
      ctx.textAlign = "left";
      ctx.font = `26px ${serif}`;
      ctx.fillStyle = "#3d3c39";
      ctx.fillText(item.label, 140, y);
      ctx.textAlign = "right";
      ctx.font = `300 34px ${mono}`;
      ctx.fillStyle = "#111";
      ctx.fillText(String(item.score), 610, y);
    });

    ctx.textAlign = "center";
    ctx.font = `20px ${serif}`;
    ctx.fillStyle = "#6d6b66";
    ctx.fillText("不是算命，而是一种理解关系的新语言", 375, 1042);
    ctx.font = `16px ${mono}`;
    ctx.fillStyle = "#9a968c";
    ctx.fillText("FATE° · 八字关系合盘", 375, 1078);

    setImage(canvas.toDataURL("image/png"));
  };

  return (
    <div className="share-card">
      <div>
        <span>SHARE</span>
        <h3>把这份合盘存成一张图</h3>
        <p>生成竖版卡片，长按（或右键）保存后可直接发给对方、发朋友圈或小红书。</p>
      </div>
      <button type="button" onClick={generate}>{image ? "重新生成 ↺" : "生成分享图 ↗"}</button>
      {image && (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={`${props.userName}与${props.partnerName}的合盘分享卡片`} />
          <figcaption>
            长按图片保存
            <a href={image} download={`fate-${props.userName}-${props.partnerName}.png`}>或点此下载</a>
          </figcaption>
        </figure>
      )}
    </div>
  );
}

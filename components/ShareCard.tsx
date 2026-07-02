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
  verdictTitle: string;
  verdictQuip: string;
  chapters: string[];
  highlights: Highlight[];
};

// 分享图：判词与幽默解读作钩子，七章目录制造"后面还有很多"的悬念。
// canvas 本机绘制，不依赖服务端字体，无网络请求。
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
    canvas.height = 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const serif = "'Songti SC','SimSun',Georgia,serif";
    const mono = "'DM Mono','Courier New',monospace";

    ctx.fillStyle = "#f4f2ed";
    ctx.fillRect(0, 0, 750, 1280);
    ctx.strokeStyle = "#c8c5bd";
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 28, 694, 1224);
    ctx.strokeRect(36, 36, 678, 1208);

    // 品牌与场景
    ctx.textAlign = "left";
    ctx.fillStyle = "#111";
    ctx.font = `600 40px ${serif}`;
    ctx.fillText("FATE°", 64, 114);
    ctx.font = `19px ${mono}`;
    ctx.fillStyle = "#6d6b66";
    ctx.fillText(`${props.relationType} · 八字关系合盘`, 64, 148);
    ctx.textAlign = "right";
    ctx.font = `26px ${mono}`;
    ctx.fillStyle = "#111";
    ctx.fillText(`${props.score}`, 656, 108);
    ctx.font = `13px ${mono}`;
    ctx.fillStyle = "#9a968c";
    ctx.fillText("契合指数 /100", 686, 138);

    // 两个人
    ctx.textAlign = "center";
    ctx.fillStyle = "#111";
    ctx.font = `46px ${serif}`;
    ctx.fillText(`${props.userName} × ${props.partnerName}`, 375, 250);
    ctx.font = `21px ${mono}`;
    ctx.fillStyle = "#6d6b66";
    ctx.fillText(`${props.userPillar}日主 · ${props.partnerPillar}日主`, 375, 290);

    // 判词：主视觉钩子
    ctx.font = `14px ${mono}`;
    ctx.fillStyle = "#9a968c";
    ctx.fillText("—— 关 系 判 词 ——", 375, 372);
    ctx.fillStyle = "#111";
    ctx.font = `400 96px ${serif}`;
    ctx.fillText(props.verdictTitle, 375, 486);
    // 幽默解读（斜体，最多四行）
    ctx.font = `italic 24px ${serif}`;
    ctx.fillStyle = "#4c4a44";
    const quipLines = wrapText(ctx, props.verdictQuip, 560).slice(0, 4);
    quipLines.forEach((line, index) => ctx.fillText(line, 375, 552 + index * 40));

    const afterQuip = 552 + quipLines.length * 40 + 26;
    ctx.strokeStyle = "#c8c5bd";
    ctx.beginPath();
    ctx.moveTo(120, afterQuip);
    ctx.lineTo(630, afterQuip);
    ctx.stroke();

    // 三项最高维度
    props.highlights.slice(0, 3).forEach((item, index) => {
      const y = afterQuip + 52 + index * 52;
      ctx.textAlign = "left";
      ctx.font = `24px ${serif}`;
      ctx.fillStyle = "#3d3c39";
      ctx.fillText(item.label, 140, y);
      ctx.textAlign = "right";
      ctx.font = `300 32px ${mono}`;
      ctx.fillStyle = "#111";
      ctx.fillText(String(item.score), 610, y);
    });

    // 七章目录：悬念钩子
    const tocTop = afterQuip + 52 + 3 * 52 + 30;
    ctx.textAlign = "center";
    ctx.font = `14px ${mono}`;
    ctx.fillStyle = "#9a968c";
    ctx.fillText("—— 这份报告还有柒章 ——", 375, tocTop);
    ctx.font = `21px ${serif}`;
    props.chapters.slice(0, 8).forEach((chapter, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? 240 : 512;
      const y = tocTop + 46 + row * 40;
      ctx.fillStyle = index === 0 ? "#111" : "#8a867c";
      ctx.fillText(index === 0 ? `${chapter} ✓` : `${chapter} ···`, x, y);
    });

    // 底部钩子
    ctx.fillStyle = "#111";
    ctx.font = `24px ${serif}`;
    ctx.fillText("判词只是开始。", 375, 1176);
    ctx.font = `15px ${mono}`;
    ctx.fillStyle = "#9a968c";
    ctx.fillText("FATE° · 输入两个生日，看你们的完整关系剧本", 375, 1210);

    setImage(canvas.toDataURL("image/png"));
  };

  return (
    <div className="share-card">
      <div>
        <span>SHARE</span>
        <h3>把这份合盘存成一张图</h3>
        <p>判词与幽默解读作封面，七章目录留悬念——发出去的是结果，勾回来的是好奇。</p>
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

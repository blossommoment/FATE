import Link from "next/link";

export default function ChatAssistant({
  contextTitle,
  contextSummary,
  suggestions,
  answer,
  baseHref,
  hiddenFields,
}: {
  contextTitle: string;
  contextSummary: string;
  evidence: string[];
  suggestions: string[];
  answer?: string;
  baseHref: string;
  hiddenFields: Record<string, string>;
}) {
  return (
    <details className="assistant-native" open={Boolean(answer)}>
      <summary className="assistant-fab"><i>缘</i><span>问问关系助手</span></summary>
      <aside className="assistant-panel">
        <header><div><small>FATE 关系助手</small><strong>{contextTitle}</strong></div></header>
        <div className="assistant-context"><span>正在结合当前卡片依据回答</span><p>{contextSummary}</p></div>
        <div className="assistant-messages">
          <div className="assistant">我正在看「{contextTitle}」。你可以问结论从哪里来，或让我换成生活里的例子。</div>
          {answer && <><div className="user">{hiddenFields.ask}</div><div className="assistant">{answer}</div></>}
        </div>
        <div className="assistant-suggestions">{suggestions.map((item) => <Link key={item} href={`${baseHref}&ask=${encodeURIComponent(item)}`}>{item}</Link>)}</div>
        <form action="/" method="get">
          {Object.entries(hiddenFields).filter(([key]) => key !== "ask").map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
          <input name="ask" defaultValue="" placeholder="追问这张卡片…" required />
          <button type="submit">↑</button>
        </form>
      </aside>
    </details>
  );
}

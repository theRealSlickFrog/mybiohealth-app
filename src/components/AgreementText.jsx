// The full Member Agreement, shown on /eula-v1 and expanded inside the Welcome
// popup. The text lives in content/member-agreement.md as the client sent it.
import agreement from '../content/member-agreement.md?raw';

// Inline marks used in the file: **bold** and *italic*.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((p, i) => {
    if (p.startsWith('**')) return <strong key={i}>{inline(p.slice(2, -2))}</strong>;
    if (p.startsWith('*') && p.length > 1) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

export default function AgreementText({ showTitle = true }) {
  const blocks = agreement.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return (
    <div className="agreement-text">
      {blocks.map((line, i) => {
        if (!line.startsWith('# ')) return <p key={i} style={{ fontSize: 15, lineHeight: 1.7, margin: '0 0 14px' }}>{inline(line)}</p>;
        if (i === 0) return showTitle ? <h1 key={i} style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400, fontSize: 30, margin: '28px 0 12px' }}>{inline(line.slice(2))}</h1> : null;
        return <h2 key={i} style={{ fontSize: 17, fontWeight: 600, margin: '26px 0 8px' }}>{inline(line.slice(2))}</h2>;
      })}
    </div>
  );
}

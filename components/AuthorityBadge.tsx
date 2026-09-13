// 权威度徽标：把知乎的 AuthorityLevel 显式呈现给用户，
// 这是「用知乎自己的信号重排」这一主张的可视化。
export function AuthorityBadge({ level }: { level: number }) {
  const n = Number.isFinite(level) ? Math.max(0, Math.min(4, Math.round(level))) : 0;
  return (
    <span className={`auth auth-${n}`} title={`知乎权威度 L${n}`}>
      L{n}
    </span>
  );
}

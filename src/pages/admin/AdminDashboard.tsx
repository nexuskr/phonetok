const KPIS = [
  { label: "총 유저", value: "—" },
  { label: "오늘 신규", value: "—" },
  { label: "출금 대기", value: "—" },
  { label: "신고 대기", value: "—" },
];

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-black">대시보드</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-xl bg-card border border-border p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-black mt-1">{k.value}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        실데이터 연결 준비 중 — Supabase RPC 연결 후 자동 표시됩니다.
      </p>
    </div>
  );
}

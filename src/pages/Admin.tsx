import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Layout from "@/components/Layout";
import { useDB, formatKRW } from "@/lib/store";
import { ShieldCheck, Users, TrendingUp, ArrowDownToLine, ArrowUpFromLine, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Admin() {
  const [db, setDb] = useDB();
  const nav = useNavigate();
  const [tab, setTab] = useState<"deposits" | "withdraws" | "users">("deposits");

  if (!db.user) { nav("/auth"); return null; }
  if (!db.user.isAdmin) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <ShieldCheck className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="font-display font-black text-2xl mt-3">접근 권한 없음</h1>
          <p className="text-xs text-muted-foreground">관리자 계정으로 로그인하세요. (admin@phonemission.kr)</p>
        </div>
      </Layout>
    );
  }

  const totalUsers = db.users.length;
  const totalDeposits = db.deposits.filter(d => d.status === "approved").reduce((s, x) => s + x.amount, 0);
  const pendingDep = db.deposits.filter(d => d.status === "pending").length;
  const pendingWd = db.withdraws.filter(d => d.status === "pending").length;

  function handleDep(id: string, status: "approved" | "rejected") {
    setDb(d => {
      const dep = d.deposits.find(x => x.id === id);
      if (!dep) return d;
      const users = d.users.map(u => u.id === dep.userId && status === "approved" ? { ...u, balance: u.balance + dep.amount } : u);
      const user = d.user?.id === dep.userId && status === "approved" ? { ...d.user, balance: d.user.balance + dep.amount } : d.user;
      return { ...d, users, user, deposits: d.deposits.map(x => x.id === id ? { ...x, status } : x) };
    });
    toast({ title: status === "approved" ? "✅ 승인 완료" : "거절 처리됨" });
  }
  function handleWd(id: string, status: "approved" | "rejected") {
    setDb(d => {
      const wd = d.withdraws.find(x => x.id === id);
      if (!wd) return d;
      // refund balance if rejected
      const users = status === "rejected" ? d.users.map(u => u.id === wd.userId ? { ...u, balance: u.balance + wd.amount } : u) : d.users;
      const user = status === "rejected" && d.user?.id === wd.userId ? { ...d.user, balance: d.user.balance + wd.amount } : d.user;
      return { ...d, users, user, withdraws: d.withdraws.map(x => x.id === id ? { ...x, status } : x) };
    });
    toast({ title: status === "approved" ? "✅ 출금 승인" : "거절 처리됨" });
  }

  return (
    <Layout>
      <div className="container pt-6 pb-10">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="w-5 h-5 text-gold" />
          <h1 className="font-display font-black text-2xl text-gradient-gold">관리자 대시보드</h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <KPI icon={Users} label="총 회원" v={totalUsers.toString()} />
          <KPI icon={TrendingUp} label="누적 충전" v={formatKRW(totalDeposits)} />
          <KPI icon={ArrowUpFromLine} label="충전 대기" v={pendingDep.toString()} hot={pendingDep > 0} />
          <KPI icon={ArrowDownToLine} label="출금 대기" v={pendingWd.toString()} hot={pendingWd > 0} />
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { id: "deposits", label: "충전 신청", icon: ArrowUpFromLine },
            { id: "withdraws", label: "출금 신청", icon: ArrowDownToLine },
            { id: "users", label: "회원 관리", icon: Users },
          ].map((t: any) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${tab === t.id ? "bg-gradient-gold text-gold-foreground glow-gold" : "glass text-muted-foreground"}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "deposits" && (
          <div className="space-y-2">
            {db.deposits.length === 0 && <Empty />}
            {db.deposits.map(d => (
              <div key={d.id} className="glass-strong rounded-2xl p-4 neon-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString("ko-KR")}</div>
                    <div className="font-bold text-sm mt-1">{d.nickname} · {d.packageName}</div>
                    <div className="font-display font-black text-lg text-gradient-gold mt-1">{formatKRW(d.amount)}</div>
                    {d.screenshot && <img src={d.screenshot} alt="proof" className="mt-2 max-h-32 rounded-lg" />}
                  </div>
                  <Status status={d.status} />
                </div>
                {d.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleDep(d.id, "approved")} className="flex-1 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center gap-1"><Check className="w-3.5 h-3.5" /> 승인</button>
                    <button onClick={() => handleDep(d.id, "rejected")} className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center gap-1"><X className="w-3.5 h-3.5" /> 거절</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "withdraws" && (
          <div className="space-y-2">
            {db.withdraws.length === 0 && <Empty />}
            {db.withdraws.map(w => (
              <div key={w.id} className="glass-strong rounded-2xl p-4 neon-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleString("ko-KR")}</div>
                    <div className="font-bold text-sm mt-1">{w.nickname}</div>
                    <div className="text-xs text-muted-foreground">{w.bank} · {w.account}</div>
                    <div className="font-display font-black text-lg text-primary mt-1">{formatKRW(w.amount)}</div>
                  </div>
                  <Status status={w.status} />
                </div>
                {w.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleWd(w.id, "approved")} className="flex-1 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center gap-1"><Check className="w-3.5 h-3.5" /> 승인</button>
                    <button onClick={() => handleWd(w.id, "rejected")} className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center gap-1"><X className="w-3.5 h-3.5" /> 거절</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-2">
            {db.users.length === 0 && <Empty />}
            {db.users.map(u => (
              <div key={u.id} className="glass rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">{u.nickname} {u.isAdmin && <span className="text-[10px] text-gold">[관리자]</span>}</div>
                  <div className="text-[10px] text-muted-foreground">{u.email} · Lv.{u.level}</div>
                </div>
                <div className="font-display font-bold text-sm text-gradient-primary">{formatKRW(u.balance)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function KPI({ icon: Icon, label, v, hot }: any) {
  return (
    <div className={`glass-strong rounded-2xl p-4 ${hot ? "neon-border animate-pulse-glow" : ""}`}>
      <Icon className="w-4 h-4 text-gold" />
      <div className="text-[10px] text-muted-foreground mt-2">{label}</div>
      <div className="font-display font-black text-lg mt-0.5">{v}</div>
    </div>
  );
}
function Status({ status }: { status: string }) {
  const m: any = { pending: ["대기", "text-gold bg-gold/15"], approved: ["승인", "text-secondary bg-secondary/15"], rejected: ["거절", "text-destructive bg-destructive/15"] };
  return <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${m[status][1]}`}>{m[status][0]}</span>;
}
function Empty() { return <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">데이터가 없습니다</div>; }

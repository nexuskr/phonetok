import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useDB, formatKRW, uid } from "@/lib/store";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Wallet() {
  const [db, setDb] = useDB();
  const nav = useNavigate();
  const [tab, setTab] = useState<"deposit" | "withdraw" | "history">("withdraw");
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("KB국민");
  const [account, setAccount] = useState("");

  if (!db.user) { nav("/auth"); return null; }
  const u = db.user;

  function withdraw() {
    const a = Number(amount);
    if (!a || a < 10000) { toast({ title: "최소 10,000원부터 출금 가능" }); return; }
    if (a > u.balance) { toast({ title: "잔고가 부족합니다" }); return; }
    if (!account) { toast({ title: "계좌번호를 입력해주세요" }); return; }
    setDb(d => ({
      ...d,
      user: d.user ? { ...d.user, balance: d.user.balance - a } : null,
      withdraws: [{
        id: uid(), userId: u.id, nickname: u.nickname, amount: a, bank, account,
        status: "pending", createdAt: Date.now(),
      }, ...d.withdraws],
    }));
    setAmount(""); setAccount("");
    toast({ title: "💸 출금 신청 완료", description: "관리자 승인 후 1시간 이내 입금됩니다." });
  }

  return (
    <Layout>
      <div className="container pt-6 pb-10">
        <h1 className="font-display font-black text-2xl flex items-center gap-2 mb-2">
          <WalletIcon className="w-5 h-5 text-primary" /> <span className="text-gradient-primary">사이버 지갑</span>
        </h1>

        <div className="glass-strong rounded-3xl p-6 neon-border relative overflow-hidden mb-5">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-primary blur-3xl opacity-50" />
          <div className="relative">
            <div className="text-xs text-muted-foreground">사용 가능 잔고</div>
            <div className="font-display font-black text-4xl mt-1 text-gradient-gold">{formatKRW(u.balance)}</div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { id: "withdraw", label: "출금", icon: ArrowDownToLine },
            { id: "deposit", label: "충전", icon: ArrowUpFromLine },
            { id: "history", label: "내역", icon: Clock },
          ].map((t: any) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${tab === t.id ? "bg-gradient-primary text-primary-foreground glow-primary" : "glass text-muted-foreground"}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "withdraw" && (
          <div className="glass-strong rounded-2xl p-5 space-y-3 neon-border">
            <Field label="출금 금액">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10,000원 이상"
                className="w-full bg-input/60 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              {[10000, 50000, 100000].map(v => (
                <button key={v} onClick={() => setAmount(String(v))} className="py-2 rounded-xl glass text-xs font-bold hover:bg-primary/10">+{v.toLocaleString()}</button>
              ))}
            </div>
            <Field label="은행">
              <select value={bank} onChange={e => setBank(e.target.value)} className="w-full bg-input/60 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary">
                {["KB국민", "신한", "우리", "하나", "농협", "카카오뱅크", "토스뱅크"].map(b => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="계좌번호">
              <input value={account} onChange={e => setAccount(e.target.value)} placeholder="'-' 없이 숫자만"
                className="w-full bg-input/60 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" />
            </Field>
            <button onClick={withdraw} className="w-full py-3.5 rounded-xl bg-gradient-primary text-primary-foreground font-bold glow-primary hover:scale-[1.02] transition">
              출금 신청
            </button>
            <p className="text-[10px] text-muted-foreground text-center">관리자 승인 후 1시간 이내 입금. 즉시 정산 보장.</p>
          </div>
        )}

        {tab === "deposit" && (
          <div className="glass-strong rounded-2xl p-5 space-y-3 neon-border text-sm">
            <p className="text-muted-foreground">VIP 패키지를 통해 충전됩니다. 패키지 페이지에서 원하는 등급을 선택해주세요.</p>
            <button onClick={() => nav("/packages")} className="w-full py-3 rounded-xl bg-gradient-gold text-gold-foreground font-bold glow-gold">패키지 보기</button>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            {[...db.deposits, ...db.withdraws]
              .filter((x: any) => x.userId === u.id)
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((x: any) => {
                const isDep = "packageId" in x;
                return (
                  <div key={x.id} className="glass rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold">{isDep ? `충전 · ${x.packageName}` : `출금 · ${x.bank}`}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(x.createdAt).toLocaleString("ko-KR")}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-display font-bold ${isDep ? "text-secondary" : "text-primary"}`}>
                        {isDep ? "+" : "-"}{formatKRW(x.amount)}
                      </div>
                      <div className={`text-[10px] font-bold ${x.status === "pending" ? "text-gold" : x.status === "approved" ? "text-secondary" : "text-destructive"}`}>
                        {x.status === "pending" ? "승인 대기" : x.status === "approved" ? "승인됨" : "거절됨"}
                      </div>
                    </div>
                  </div>
                );
              })}
            {[...db.deposits, ...db.withdraws].filter((x: any) => x.userId === u.id).length === 0 && (
              <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">아직 거래 내역이 없습니다</div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function Field({ label, children }: any) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-1.5 font-bold">{label}</div>
      {children}
    </div>
  );
}

/**
 * UserDetail360 — 회원 검색 + 360도 상세 (Day 2)
 * 프로필 / 잔액 / 입출금 / 이상감지 / Crown / 포지션
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingCard } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { notify } from "@/lib/notify";
import { Search, User } from "lucide-react";

type View = {
  profile: any;
  phon_balance: number;
  deposits: any[];
  withdrawals: any[];
  anomalies: any[];
  crown_events: any[];
  positions: any[];
};

export default function UserDetail360() {
  const { uid: routeUid } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(routeUid ?? "");
  const [data, setData] = useState<View | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async (uid: string) => {
    setLoading(true);
    setData(null);
    const { data: row, error } = await supabase.rpc("admin_get_user_360" as any, { _uid: uid });
    setLoading(false);
    if (error) {
      notify.error(error.message);
      return;
    }
    if (!row || !(row as any).profile) {
      notify.warning("회원을 찾을 수 없습니다");
      return;
    }
    setData(row as any);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = query.trim();
    if (!v) return;
    navigate(`/admin/product/users/${v}`);
    lookup(v);
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-xl sm:text-2xl">
          <User className="inline h-5 w-5 mr-1" /> 회원 360
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          UUID 또는 이메일 prefix로 검색 → 프로필·잔액·입출금·이상감지·Crown 한눈에
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          placeholder="user_id (uuid)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="font-mono"
        />
        <Button type="submit" disabled={loading}>
          <Search className="h-4 w-4 mr-1" /> 조회
        </Button>
      </form>

      {loading && <LoadingCard />}

      {data && (
        <div className="space-y-4">
          <ProfileCard profile={data.profile} balance={data.phon_balance} />
          <Section title="입금 (최근 20)" rows={data.deposits} cols={["status", "amount", "method", "created_at"]} />
          <Section title="출금 (최근 20)" rows={data.withdrawals} cols={["status", "amount", "method", "created_at"]} />
          <Section title="이상감지 (최근 20)" rows={data.anomalies} cols={["rule", "severity", "acknowledged", "created_at"]} />
          <Section title="Crown (최근 20)" rows={data.crown_events} cols={["event_type", "base_amount", "awarded_amount", "created_at"]} />
          <Section title="오픈 포지션" rows={data.positions} cols={["symbol", "side", "size", "leverage"]} />
        </div>
      )}

      {!loading && !data && (
        <EmptyState title="UUID 입력 후 조회" description="우측 회원 목록(/admin/product/users)에서도 진입할 수 있습니다." />
      )}
    </div>
  );
}

function ProfileCard({ profile, balance }: { profile: any; balance: number }) {
  return (
    <div className="glass-strong rounded-2xl p-4 border border-border/40">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Field k="ID" v={<span className="font-mono text-[11px]">{profile?.id}</span>} />
        <Field k="닉네임" v={profile?.nickname ?? "—"} />
        <Field k="등급" v={profile?.tier ?? "—"} />
        <Field k="Empire Lv" v={profile?.empire_level ?? 1} />
        <Field k="PHON 잔액" v={Number(balance ?? 0).toLocaleString()} />
        <Field k="총 입금" v={Number(profile?.total_deposit ?? 0).toLocaleString()} />
        <Field k="총 출금" v={Number(profile?.total_withdraw ?? 0).toLocaleString()} />
        <Field k="가입" v={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("ko-KR") : "—"} />
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase">{k}</div>
      <div className="font-bold tabular-nums">{v}</div>
    </div>
  );
}

function Section({ title, rows, cols }: { title: string; rows: any[]; cols: string[] }) {
  return (
    <div className="glass-strong rounded-2xl p-4 border border-border/40">
      <div className="text-sm font-bold mb-2">{title} <span className="text-xs text-muted-foreground">({rows?.length ?? 0})</span></div>
      {!rows || rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">기록 없음</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>{cols.map((c) => <th key={c} className="text-left font-normal pb-1 pr-3">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? i} className="border-t border-border/20">
                  {cols.map((c) => (
                    <td key={c} className="py-1 pr-3 font-mono">
                      {String(r[c] ?? "—").slice(0, 40)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

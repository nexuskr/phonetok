import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";

type Row = {
  campaign_key: string;
  title: string;
  dormant_days: number;
  phon_bonus: number;
  sent_30d: number;
  opened_30d: number;
  clicked_30d: number;
  claimed_30d: number;
  open_rate: number;
  click_rate: number;
  claim_rate: number;
  phon_credited_30d: number;
};

export default function ReactivationFunnelPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc("admin_get_reactivation_funnel");
      if (!alive) return;
      if (error) { setError(error.message); setRows([]); return; }
      setRows((data ?? []) as Row[]);
    })();
    return () => { alive = false; };
  }, []);

  if (rows === null) return <LoadingList />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔁 Reactivation Funnel <span className="text-xs font-normal text-muted-foreground">(30d)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {rows.length === 0 ? (
          <EmptyState title="아직 캠페인 데이터가 없습니다" description="cron이 매일 10:00 KST에 실행되며, 휴면 사용자가 누적되면 표시됩니다." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>캠페인</TableHead>
                <TableHead className="text-right">발송</TableHead>
                <TableHead className="text-right">열람률</TableHead>
                <TableHead className="text-right">클릭률</TableHead>
                <TableHead className="text-right">클레임률</TableHead>
                <TableHead className="text-right">PHON 지급</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.campaign_key}>
                  <TableCell>
                    <div className="font-medium">{r.title}</div>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="outline" className="text-[10px]">{r.dormant_days}d 휴면</Badge>
                      <Badge variant="outline" className="text-[10px]">+{r.phon_bonus} PHON</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.sent_30d}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.open_rate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{r.click_rate}%</TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-primary">{r.claim_rate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{r.phon_credited_30d.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

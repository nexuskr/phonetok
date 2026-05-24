import { Users, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function Refer() {
  const code = "PHONARA-XXXX";
  function copy() {
    navigator.clipboard.writeText(`https://phonara.world/?ref=${code}`);
    toast.success("초대 링크가 복사되었습니다");
  }
  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">친구 추천</h1>
      </header>

      <section className="rounded-2xl bg-gradient-to-br from-primary/15 to-card border border-primary/20 p-6 space-y-3">
        <div className="text-sm text-muted-foreground">친구 1명당</div>
        <div className="text-4xl font-black text-primary">+ 5,000 PHON</div>
        <div className="text-sm text-muted-foreground">친구가 첫 미션을 완료하면 즉시 지급</div>
      </section>

      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <div className="text-xs text-muted-foreground">내 초대 코드</div>
        <div className="flex items-center justify-between">
          <code className="text-lg font-bold">{code}</code>
          <button onClick={copy} className="p-2 rounded-lg hover:bg-muted">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      <button
        onClick={copy}
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold"
      >
        <Share2 className="h-5 w-5" /> 초대 링크 공유
      </button>
    </main>
  );
}

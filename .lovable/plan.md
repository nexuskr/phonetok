# PR-I — Active Governor + Degrade Mode

Phase 3 첫 장. Phase 2 Visibility(PR-A~H)는 EXIT 동결. 잔여 hidden/idle 1~2건 noise는 수용.
이 PR은 cooperative pause → **hard kill** 한 단계 진입 + `§14-5 Emergency Degrade Mode`를 platform 레벨로 노출.

money-flow 8경로 (`use-wallet`, `useWithdrawQueue`, `cashLoop`, `walletRefresh`, `phonSpend`, `request_withdrawal` 호출부, `live_positions` 트리거 클라, `credit_crypto_deposit` 응답 핸들러) **git diff 0줄** 절대 유지.

---

## 1. 변경 파일 목록

신규
- `src/hooks/use-degrade-mode.ts`
- `src/components/system/DegradeModeBinder.tsx`
- `supabase/migrations/<ts>_pr_i_degrade_mode.sql`

수정
- `src/packages/runtime/runtime.governor.ts` — `killCategory` / `killAll` 실구현
- `src/packages/runtime/runtime.registry.ts` — `clearTrackedInterval(id)` 헬퍼 추가 (네이티브 `clearInterval` + `forgetInterval`)
- `src/App.tsx` — `<DegradeModeBinder />` 루트 마운트
- `src/hooks/use-kill-switches.ts` — `KillSwitches` 타입에 `degrade_mode` 추가, DEFAULT 확장
- `src/pages/admin/SelfHeal.tsx` (또는 현 패널 컴포넌트) — Degrade 토글 UI + reason 입력
- `src/packages/core/i18n/glossary.ts` — `degrade.on/off/reason/banner` 키 추가
- `reports/governor.kill.2026-05-17.json` — 첫 kill 실측 스냅샷

불변 (절대 미접근)
- `src/lib/cashLoop.ts`, `src/lib/walletRefresh.ts`, `src/lib/phonSpend.ts`, `src/lib/withdrawal/useWithdrawQueue.ts`, `src/hooks/use-wallet.ts`, money-flow 12 raw setInterval 경로 전체

---

## 2. 핵심 코드 변경 포인트

### 2-1. `runtime.governor.ts` — Phase 4 LIVE 진입
```ts
const MONEY_FLOW_GUARD: RuntimeCategory[] = ["money_flow"]; // hard whitelist

export function killCategory(cat: RuntimeCategory): number {
  if (MONEY_FLOW_GUARD.includes(cat)) {
    console.warn("[runtime.governor] killCategory blocked: money_flow is immutable");
    return 0;
  }
  const ids = listIdsByCategory(cat);
  let n = 0;
  for (const id of ids) {
    try { clearInterval(id); forgetInterval(id); n++; } catch {}
  }
  (window as any).__phonaraGovernor = { lastKill: { cat, n, at: Date.now() } };
  if (import.meta.env.DEV) console.warn(`[runtime.governor] killCategory(${cat}) → cleared ${n} ids`);
  return n;
}

export function killAll(): number {
  return (["cosmetic", "admin"] as const).reduce((s, c) => s + killCategory(c), 0);
}
```
- money_flow는 카테고리 자체가 untracked Map에만 들어가므로 `listIdsByCategory("money_flow")`는 항상 빈 배열이지만, **방어층 1차로 화이트리스트 명시**.

### 2-2. DB — `platform_kill_switches` 확장
```sql
ALTER TABLE public.platform_kill_switches
  ADD COLUMN IF NOT EXISTS degrade_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS degrade_reason text;
-- 기존 RLS/RPC(admin_set_kill_switch)는 key='degrade_mode' 행으로 처리되도록
-- 시드 INSERT는 별도 insert 도구로(스키마 변경 아님). 본 마이그레이션은 컬럼만.
```
실제 운용은 기존 `platform_kill_switches` row 모델(`key`/`enabled`/`reason`) 유지가 일관성 좋음 → **대안 채택**: 컬럼 추가 대신 `INSERT INTO platform_kill_switches(key,enabled,reason) VALUES ('degrade_mode',false,null)` 시드 1행. → 마이그레이션 파일은 **시드 1행 + 댓글만**.

### 2-3. `use-degrade-mode.ts`
```ts
import { useKillSwitches } from "@/hooks/use-kill-switches";
export function useDegradeMode() {
  const ks = useKillSwitches();
  return {
    degraded: !!(ks as any).degrade_mode,
    reason: ks.reasons?.degrade_mode ?? null,
    loaded: ks.loaded,
  };
}
```
`KillSwitches` 타입에 `degrade_mode: boolean` 추가 + DEFAULT/parser 분기에 키 등록.

### 2-4. `DegradeModeBinder.tsx`
```tsx
export function DegradeModeBinder() {
  const { degraded } = useDegradeMode();
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (degraded) {
      document.body.dataset.degrade = "1";
      import("@pkg/runtime").then(m => m.killCategory("cosmetic"));
      notify.important(g("degrade.banner"));
    } else {
      delete document.body.dataset.degrade;
    }
  }, [degraded]);
  return null;
}
```
- Tailwind `degrade:` variant 활성.
- ON 순간 cosmetic interval 회수 → 즉시 시각/리소스 부담 ↓.

### 2-5. `App.tsx`
```tsx
<DegradeModeBinder />
```
기존 `<LegalConsentGate />` 옆 한 줄.

### 2-6. Self-Heal 패널 (Operator-only, AAL2)
- "🛡 Degrade Mode" 카드: 현재 상태 칩 + reason textarea + `admin_set_kill_switch('degrade_mode', enabled, reason)` 호출.
- 토글 ON 시 destructive Confirm Dialog (`degrade.confirm.on`).

### 2-7. Glossary 키 (50-70대 친화 문구)
- `degrade.banner` = "지금 시스템 보호 모드입니다 — 잠시만요"
- `degrade.confirm.on` = "정말 비상 절전 모드를 켤까요? 화면 효과가 꺼집니다"
- `degrade.off` = "정상 모드"

---

## 3. 네이밍 규칙 준수 확인

| 항목 | 적용 |
|------|------|
| 패키지 alias | `@pkg/runtime` 만 사용 (`killCategory` re-export 통해) |
| 훅 파일 | `use-degrade-mode.ts` kebab + `useDegradeMode` PascalCamel |
| 컴포넌트 | `DegradeModeBinder.tsx` PascalCase |
| 카테고리 키 | `"cosmetic" / "admin" / "money_flow"` snake 고정 |
| Kill switch key | `degrade_mode` snake (기존 `*_halt` 규칙과 통일) |
| Migration 파일 | `<YYYYMMDDHHMMSS>_pr_i_degrade_mode.sql` |
| 콘솔 prefix | `[runtime.governor]` 고정 |
| 리포트 | `reports/governor.kill.<YYYY-MM-DD>.json` |

---

## 4. 검증 항목

1. **money-flow freeze**
   `node scripts/check-money-flow-freeze.mjs` → `[freeze] OK — 8 money-flow paths intact`
   PR diff에 `cashLoop|walletRefresh|phonSpend|useWithdrawQueue|use-wallet` 0 hit.

2. **Governor 실행**
   DEV 콘솔
   ```
   __phonaraSurface.runScenario({ activeMs:30000, hiddenMs:30000, idleMs:30000 })
   await (await import("@pkg/runtime")).killCategory("money_flow")  // → 0 (blocked)
   await (await import("@pkg/runtime")).killCategory("cosmetic")    // → N>0
   ```
   → `__phonaraGovernor.lastKill.n > 0`, money_flow 시도 시 `blocked` 로그.

3. **Degrade Mode E2E**
   `/admin/ops/self-heal` → Degrade ON → 비-admin 브라우저
   - `body[data-degrade="1"]` 적용
   - `notify.important` 토스트 1회
   - `__phonaraSurface.runScenario()` cosmetic bucket = 0 hard
   - OFF 복귀 시 dataset 제거, 정상 토스트.

4. **Build**
   `bun run build` → entry chunk 사이즈 회귀 없음 (±0.5KB gz 이내).
   `scripts/bundle-check.mjs` Layer 1 PASS.

5. **DB**
   `supabase--linter` → 신규 경고 0.
   `select * from platform_kill_switches where key='degrade_mode'` 1행 존재.

6. **RLS 회귀**
   `vitest run src/test/db-permissions.test.ts` PASS.

---

## 5. 예상 영향 범위

- **Bundle**: `DegradeModeBinder` + hook = ~0.4KB gz. 신규 lib import 없음.
- **Money-flow**: 0줄 diff. `killCategory` 화이트리스트로 이중 방어.
- **UX (50-70대)**: degrade ON 시 큰 글씨 토스트 + Warm Gold 배너만 노출. 입출금/베팅 흐름 영향 없음.
- **운영**: Self-Heal 한 패널로 비상 절전 토글 가능. cron/엣지 영향 없음.
- **롤백**: Self-Heal에서 OFF 1클릭. 마이그레이션은 시드 1행이므로 `DELETE FROM platform_kill_switches WHERE key='degrade_mode'` 1줄로 회복.

---

## 6. PR-I 종료 기준

- [ ] 6개 검증 항목 모두 PASS
- [ ] `reports/governor.kill.2026-05-17.json` 커밋 (kill 실측 1회)
- [ ] `mem://features/phase-3-active-governance` 신규 + `mem://index.md` Core 한 줄 추가:
  > Phase 3 Active Governor: `killCategory("cosmetic"|"admin")` LIVE — money_flow 화이트리스트 차단. Degrade Mode는 `platform_kill_switches.key='degrade_mode'` + `useDegradeMode()` + `<DegradeModeBinder/>` + `body[data-degrade="1"]` + Tailwind `degrade:` variant.

승인되면 PR-I 실시간 구현 → 머지 → 곧바로 **PR-J Realtime Partition 마이그레이션** 플랜 제출.

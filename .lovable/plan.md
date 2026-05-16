# PR-J — Realtime Partition Migration (FINAL)

목표: 프로젝트 내 모든 Realtime 구독을 4-파티션(`wallet / game / chat / market`)으로 일괄 정렬하고, raw `useRealtimeChannel` / `supabase.channel(...)` 직접 호출을 ESLint로 빌드 차단. money-flow 8경로는 git diff = 0줄 유지(읽기 전용 realtime은 `useWalletChannel`만 사용).

---

## 1. 인벤토리 (43개 호출 → 4 파티션 분류)

### wallet (잔액·입출금·PHON·NFT 자산 — 24h 안에 돈으로 환산되는 모든 read realtime)
- `src/hooks/use-wallet.ts` (wallet_balances, live_trade_history)
- `src/hooks/use-my-power.ts` (phon_balances, nft_collection)
- `src/hooks/use-empire-booster.ts` (empire_boosters)
- `src/lib/withdrawal/useWithdrawQueue.ts` (withdrawal_requests)
- `src/packages/wallet/hooks/useWalletSnapshot.ts`
- `src/packages/wallet/hooks/useDepositRealtime.ts` (crypto_deposit_intents)
- `src/packages/wallet/components/WithdrawHistory.tsx`
- `src/packages/wallet/components/DepositHistory.tsx`
- `src/components/wallet/WithdrawalHistoryList.tsx`
- `src/components/wallet/WithdrawSimpleStatus.tsx`
- `src/components/wallet/WithdrawQueueStatus.tsx`
- `src/components/wallet/DepositHistoryList.tsx`
- `src/pages/MyFoundingSeat.tsx` (founding_season_seats — 결제성)
- `src/components/profile/NftAvatar.tsx` (nft_collection)

### game (슬롯·라이브 포지션·크래시·잭팟·empire 게임 이벤트)
- `src/pages/Crash.tsx`
- `src/hooks/use-crown-war.ts`
- `src/components/empire/JackpotEmpireBanner.tsx`
- `src/components/empire/BaronPromotionDialog.tsx`
- `src/components/slots/JackpotMeter.tsx`
- `src/components/dashboard/v3/ActivityEventTicker.tsx`
- `src/components/LiveRanking.tsx`
- `src/components/AIBotCards.tsx` (2 호출 — 봇 시그널)
- `src/hooks/use-fomo-notifications.ts`
- `src/lib/trading/real-store.ts`

### chat (채팅·서포트·DM·관리자 알림)
- `src/pages/Support.tsx`
- `src/pages/SupportTickets.tsx`
- `src/pages/admin/Support.tsx`
- `src/pages/Admin.tsx` (3 호출 — 알림/티켓)
- `src/pages/admin/AdminAudit.tsx`
- `src/components/admin/FoundingSeasonsAdmin.tsx`
- `src/components/admin/compliance/audit/SecurityAuditAdmin.tsx`
- `src/components/admin/GodModePanel.tsx` (`useRealtimeChannel` 호출만 — line 250)

### market (오라클·티커·예측시장)
- (현재 직접 호출 없음 — `oracle_prices` 구독은 `phon_balances` 트리거로만 발생. 향후 oracle UI 추가 시 진입점 확보.)

### 화이트리스트 예외 (raw `supabase.channel` 유지)
- `src/hooks/use-realtime-channel.ts` — 단일 socket factory (래퍼 본체)
- `src/packages/realtime/index.ts` — 4-파티션 래퍼
- `src/lib/realtime-bus.ts` — back-compat 진입점
- `src/components/admin/GodModePanel.tsx` line 92 — **presence** 채널(postgres_changes 아님). 별도 주석으로 whitelisted, ESLint 인라인 disable 유지.

---

## 2. `@pkg/realtime/index.ts` 재설계

```ts
// LOCKED v3.1 Phase 3 PR-J — Realtime 4-way Partition (Strict)
//
// 외부 코드는 useRealtimeChannel / supabase.channel 을 직접 import 금지.
// 4 파티션 wrapper 만 사용:
//   useWalletChannel  wallet:<resource>[:id]
//   useGameChannel    game:<resource>[:id]
//   useChatChannel    chat:<resource>[:id]
//   useMarketChannel  market:<resource>[:id]
//
// money-flow 관련 read realtime 은 무조건 useWalletChannel.

import {
  useRealtimeChannel,
  type UseRealtimeChannelOpts,
  type ConnState,
} from "@/hooks/use-realtime-channel";

export type RealtimePartition = "wallet" | "game" | "chat" | "market";
export type PartitionOpts = Omit<UseRealtimeChannelOpts, "key"> & { key: string };
export type { ConnState };

const LOG = "[PHONARA REALTIME]";

function buildKey(part: RealtimePartition, key: string): string {
  if (!key) return "";
  if (key.startsWith(`${part}:`)) return key;
  if (import.meta.env.DEV && /^(wallet|game|chat|market):/.test(key)) {
    console.warn(`${LOG} cross-partition key "${key}" mounted on ${part} — fix to ${part}:*`);
  }
  return `${part}:${key}`;
}

export function useWalletChannel(opts: PartitionOpts) {
  return useRealtimeChannel({ ...opts, key: buildKey("wallet", opts.key) });
}
export function useGameChannel(opts: PartitionOpts) {
  return useRealtimeChannel({ ...opts, key: buildKey("game", opts.key) });
}
export function useChatChannel(opts: PartitionOpts) {
  return useRealtimeChannel({ ...opts, key: buildKey("chat", opts.key) });
}
export function useMarketChannel(opts: PartitionOpts) {
  return useRealtimeChannel({ ...opts, key: buildKey("market", opts.key) });
}
```

타입 안전성: `PartitionOpts` 가 `key`를 필수로 강제. 호출부는 `wallet:` 등 prefix를 생략해도 자동 부여.

---

## 3. 일괄 교체 패턴 (예시)

**Before:**
```ts
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
useRealtimeChannel({
  key: `wallet:${userId}`,
  bindings: [{ event: "UPDATE", table: "wallet_balances", filter: `user_id=eq.${userId}` }],
  onEvent: ...,
});
```

**After:**
```ts
import { useWalletChannel } from "@pkg/realtime";
useWalletChannel({
  key: `balances:${userId}`,             // prefix 자동 부여 → wallet:balances:<id>
  bindings: [{ event: "UPDATE", table: "wallet_balances", filter: `user_id=eq.${userId}` }],
  onEvent: ...,
});
```

money-flow 8경로 파일(`src/lib/wallet.ts`, `src/lib/walletRefresh.ts`, withdraw/deposit RPC 등) 자체는 **0줄 변경**. `useWallet`/`useWithdrawQueue` 등 read-only 훅만 import 라인을 교체한다.

---

## 4. ESLint 강화 — `no-raw-channel` LOCK

`eslint.config.js`:

```js
// Critical lockdown
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: [
    "src/hooks/use-realtime-channel.ts",
    "src/packages/realtime/**",
    "src/lib/realtime-bus.ts",
  ],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "@/hooks/use-realtime-channel",
          message: "Use @pkg/realtime wrappers (useWalletChannel/useGameChannel/useChatChannel/useMarketChannel). (PR-J)" },
      ],
    }],
    "no-restricted-syntax": ["error", {
      selector: "CallExpression[callee.object.name='supabase'][callee.property.name='channel']",
      message: "Direct supabase.channel() forbidden. Use @pkg/realtime wrappers. (PR-J)",
    }],
  },
},
```

- `LEGACY_RAW_CHANNEL` grandparent list → **빈 배열**로 축소(파일은 살리되 더 이상 violator 0건).
- `GodModePanel` line 92 presence 호출은 인라인 `// eslint-disable-next-line no-restricted-syntax -- presence channel whitelisted (PR-J)`.

---

## 5. 50-70대 친화 glossary 추가

`src/lib/glossary.ts` 에 신규 키:
- `realtime.reconnecting` — "잠시만요, 다시 연결하고 있습니다…"
- `realtime.degraded` — "실시간 연결이 잠시 느려졌어요. 데이터는 안전합니다."
- `realtime.restored` — "다시 실시간으로 연결됐어요."

`use-realtime-channel.ts` 의 `ConnState` 변경 시 Degrade Mode와 연동하여 `notify.passive`로 안내(별도 컴포넌트 변경 없이, 향후 toast hook 에서 활용).

---

## 6. 검증 & 리포트

```
rg "from \"@/hooks/use-realtime-channel\"" src        # 0건 (래퍼/whitelist 제외)
rg "supabase\\.channel\\(" src | grep -v whitelist    # 1건 (GodModePanel presence)
node scripts/check-money-flow-freeze.mjs              # PASS (8경로 0줄)
bun run lint                                          # 0 error
bun run build                                         # PASS
```

DEV 콘솔 스모크:
1. `/wallet` → 입금/출금 — WS frame `wallet:*` 만 발생
2. `/crash`, `/casino/*` → `game:*`
3. `/support`, `/admin` → `chat:*`
4. 잔액 / Crown War / 채팅 알림 즉시 갱신 확인
5. `__phonaraGovernor.lastKill` — money_flow 0건 유지

`reports/realtime.partition.2026-05-18.json`:
```json
{
  "date": "2026-05-18",
  "partitions": { "wallet": 14, "game": 11, "chat": 9, "market": 0 },
  "raw_useRealtimeChannel_callers": 0,
  "raw_supabase_channel_callers": 1,
  "whitelist": ["use-realtime-channel.ts","@pkg/realtime","realtime-bus.ts","GodModePanel#presence"],
  "money_flow_diff_lines": 0,
  "smoke": { "wallet": "PASS", "game": "PASS", "chat": "PASS", "market": "N/A" }
}
```

---

## 7. 영향 범위

- **Bundle**: 래퍼 추가 ~0.4KB, import 경로 변경뿐 → Layer 1 budget 영향 없음
- **money-flow**: 0줄 (다층 가드 + freeze check)
- **UX**: 사용자 가시 변화 없음. degrade/reconnect 안내 문구만 따뜻한 톤으로 추가
- **운영**: WS frame 라벨이 `wallet:* / game:* / chat:* / market:*` 4종으로만 보여 디버깅 가시성 ↑

---

## 8. Exit 기준

1. raw `useRealtimeChannel` import 0건 (래퍼/whitelist 제외)
2. raw `supabase.channel` 호출 1건만(GodModePanel presence)
3. ESLint `no-raw-channel` grandparent 빈 배열
4. money-flow freeze PASS
5. `reports/realtime.partition.2026-05-18.json` 커밋
6. `mem://realtime/unified-channel` 업데이트
7. Smoke 4종 PASS

---

# ✅ PR-J 설계 완료 → 다음 PR-K 예고

## PR-K — Operator Isolation (Layer 분리 최종)
- `@pkg/operator/*`(관리자 콘솔·운영 도구)를 별도 chunk로 완전 분리
- React Router 의 admin route를 `lazy(() => import("@pkg/operator/..."))` 로만 진입
- dependency-cruiser 룰: `@pkg/wallet`/`@pkg/core`/`@pkg/runtime` → `@pkg/operator` import 금지(이미 적용, **strict mode**로 격상 + CI fail)
- bundle-check: Layer1(user) 번들에서 operator 코드 0바이트 확인 스크립트(`scripts/check-operator-isolation.mjs`)
- Degrade Mode ON 시 operator chunk preload 자동 cancel
- 검증: `dist/assets/operator-*.js` 분리 확인, `dist/assets/index-*.js` size 회귀 ≤ 0
- 리포트: `reports/operator.isolation.2026-05-19.json`

Phase 3 종료 조건: PR-I + PR-J + PR-K 모두 머지, money-flow 8경로 0줄, runScenario degrade ON 시 cosmetic=0 hard, `mem://features/phase-3-active-governance` 최종 업데이트.

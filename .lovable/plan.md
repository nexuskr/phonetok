# Slice 8 — Imperial Duel PVP System

황제 대결 시스템. money-flow 8경로와 완전 분리된 `pvp_ledger` + 전용 RPC로 구현. 실시간 룸 + 자동 정산 + 시즌 리더보드.

## 핵심 컨셉

- **1:1 Duel** — 가장 빠른 매칭, 라이브 카운터, 60~120s 결정전.
- **Royal Battle (4~6명)** — 베팅풀 분할, 1·2·3등 차등 지급.
- **Emperor Throne (2~8명)** — 토너먼트형, Crown ×3 + Emperor 칭호.
- **모드**: Trade(BTC/ETH 60s 방향) / Slot(고정 RTP 1라운드) / Crash(공유 시드).
- **House Edge** 12~15% (Crown 시즌 풀 + 운영비), **연패 보호** 3연패 시 다음 매치 참가비 50%.

## 데이터 모델 (신규 — money-flow 미터치)

```text
pvp_duels                 — 한 대결 단위
  id uuid pk
  mode text                 ('trade'|'slot'|'crash')
  format text               ('1v1'|'royal'|'throne')
  capacity int              (2|4|6|8)
  entry_phon bigint         (참가비, 잠금)
  status text               ('open'|'locked'|'running'|'settled'|'cancelled')
  seed text                 (정산용 결정값)
  symbol text               (trade 모드: BTCUSDT 등, nullable)
  created_by uuid
  starts_at, ends_at, settled_at timestamptz
  metadata jsonb

pvp_duel_participants
  duel_id uuid fk
  user_id uuid
  joined_at timestamptz
  position smallint          (정산 후 1=승, 2..n=순위)
  payout_phon bigint default 0
  result jsonb               (직관 데이터: 방향/배율 등)
  UNIQUE(duel_id, user_id)

pvp_ledger                 — 잠금/지급 완전 분리 원장
  id uuid pk
  user_id uuid
  duel_id uuid
  kind text                  ('lock'|'refund'|'payout'|'fee')
  amount_phon bigint         (lock/fee는 음수, refund/payout 양수)
  created_at timestamptz

pvp_season
  id smallserial pk
  name text
  starts_at, ends_at timestamptz
  prize_pool_phon bigint
  active bool

pvp_season_stats           — 사용자별 시즌 집계 (정산 시 upsert)
  season_id, user_id pk
  duels_played int
  wins int
  crown_points int
  net_phon bigint
  loss_streak int            (연패 보호용)

platform_kill_switches.key='pvp_engine'  — kill 게이트
```

RLS 요약:
- `pvp_duels` / `pvp_duel_participants` SELECT = authenticated (공개 로비).
- INSERT/UPDATE는 전부 SECURITY DEFINER RPC를 통해서만. 직접 INSERT 차단.
- `pvp_ledger` SELECT = 본인(user_id=auth.uid()) + admin. INSERT는 RPC만.
- `pvp_season_stats` SELECT = authenticated (리더보드용). INSERT/UPDATE = RPC만.

## RPC (모두 SECURITY DEFINER, idempotent, kill-switch 체크)

- `pvp_create_duel(_mode, _format, _capacity, _entry_phon, _symbol)` → duel_id. PHON 잔액 ≥ entry, 본인 자동 join, `pvp_ledger` lock 기록.
- `pvp_join_duel(_duel_id)` → ok. capacity 도달 시 status='locked' + starts_at=now()+lobby_grace.
- `pvp_leave_duel(_duel_id)` → starts_at 전에만 가능, lock 환불.
- `pvp_cancel_duel(_duel_id)` → 본인 created_by 또는 admin, lobby 단계만, 전원 환불.
- `pvp_settle_duel(_duel_id)` → 결과 산출(mode별 시드 기반) + 순위·payout 계산 + `pvp_ledger` payout/fee 적재 + `pvp_season_stats` upsert(Crown Point: 승 +20, 2등 +8, 3등 +3, 연패 보호 적용). 중복 호출 idempotent(status='settled' 가드).
- `pvp_get_open_lobby(_limit)` → 공개 RPC, 진행 중·대기 중 듀얼 카드.
- `pvp_get_my_active()` → 내가 참여한 진행 중 듀얼.
- `pvp_get_leaderboard(_season_id?, _limit)` → Top N (닉네임 마스킹).
- 관리자: `admin_pvp_force_settle(_id)`, `admin_pvp_get_metrics_24h()`.

내부 보조:
- `_pvp_lock_funds(uid, amount, duel_id)` / `_pvp_credit(uid, amount, kind, duel_id)` — `pvp_ledger` 적재 + `phon_balances` 차감/가산 (이 함수는 phon_balances만 건드림, money-flow의 8경로 RPC와 분리된 새 경로).
- `_pvp_compute_result(duel_id)` — 모드별 결정 로직(시드 SHA256 + 외부 price snapshot RPC 재사용).

Realtime:
- `pvp_duels` / `pvp_duel_participants` publication 추가 → `useGameChannel` 래퍼로 구독.

## UI (`src/components/pvp/*`, `src/pages/pvp/*`)

- `/pvp` Duel Lobby — 모드/포맷 필터, 오픈 듀얼 카드 리스트, "도전" CTA, 내 활성 듀얼 핀.
- `<DuelCreatePanel />` — 모드·포맷·capacity·entry PHON 슬라이더(추천값 + house edge 안내).
- `<DuelRoom />` (`/pvp/:id`) — 참가자 슬롯, 카운트다운, 실시간 진입/이탈, 카오스 호흡 효과, 결과 직전 긴장 빌드업.
- `<DuelResultOverlay />` — 승/패/순위, Crown Point 변화, "다시 도전" CTA.
- `<DuelLeaderboard />` — `/pvp/hall` Hall of Fame, 시즌 Top 50 + 마이 랭크.
- `<DuelEntryFAB />` — Layout 전역(데스크탑 우하단·모바일 PhonaraNav 옆), 진행 중 듀얼 있을 때 펄스.
- 클라 래퍼 `src/lib/pvp.ts` (모든 RPC 타입세이프 호출).
- 디자인: Slice 7 토큰(`imperial-card-hover`, `pulse-halo`, `glow-pink-xl`, `imperial-jackpot-breathe`) 적극 사용. Hot Pink = 도전, Gold = 승리.

## 절대 불변

- money-flow 8경로 (`request_withdrawal`, `credit_crypto_deposit`, `bet_*` 류 등) **git diff 0줄**.
- `phon_balances` 직접 INSERT/UPDATE는 신규 `_pvp_lock_funds`/`_pvp_credit` SECURITY DEFINER에서만, 모든 변동은 `pvp_ledger`로 미러링되어 정합성 검증 가능.
- Realtime은 `@pkg/realtime`의 `useGameChannel` 래퍼만 사용. raw `supabase.channel(...)` 금지.
- 디자인 토큰만 사용, 하드코딩 색상 금지.
- Operator Isolation / Bundle Budget / Phase D·F 미터치.

## 마이그레이션 / 작업 순서

1. **Migration A** — 테이블 + RLS + 인덱스 + kill switch 시드 (`pvp_engine`).
2. **Migration B** — 모든 RPC + 내부 보조 함수 + `function_permissions_baseline` 등록.
3. **Realtime publication** 추가.
4. **클라 코드** — `src/lib/pvp.ts` + 컴포넌트 + 페이지 + 라우트 등록 + FAB 마운트.
5. **검증** — `bunx tsc --noEmit`, /pvp 수동 테스트, 강제 정산 RPC로 정산 경로 확인.

## 검수 체크리스트

- [ ] money-flow freeze CI 통과 (변경 0).
- [ ] `pvp_ledger` SELECT 본인-only 확인.
- [ ] `pvp_settle_duel` 중복 호출 idempotent.
- [ ] kill switch ON 시 신규 듀얼 생성/참가 차단.
- [ ] 리더보드 닉네임 마스킹 적용.
- [ ] Bundle Budget 초과 없음.

## 완료 보고

`✅ Slice 8 Imperial Duel PVP System 완료` + 주요 스크린샷 (Lobby / Room / Result / Hall of Fame).

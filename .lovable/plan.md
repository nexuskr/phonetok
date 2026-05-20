# P5-A — Tier S+ Expansion (5 New Games)

기존 `apex_play_mock_game` RPC 6코드(dice/crash/plinko/mines/slots_lite/sportsbook)를 그대로 활용. 신규 게임은 모두 백킹 RPC 코드에 매핑(display 코드 → backing 코드)되어 머니플로 git diff = 0 보장. House-edge §6 수식 0 터치 — 신규 게임 RTP는 메타데이터 카탈로그(`TIER_S` Record)에만 기재.

## 5 신규 게임 매핑

| Display 코드      | 백킹 RPC 코드  | RTP    | 비고                                              |
| ----------------- | -------------- | ------ | ------------------------------------------------- |
| `crash_mc`        | `crash`        | 99.0%  | 3-step partial cashout 슬라이더 (33/66/100% 표시) |
| `hashdice`        | `dice`         | 99.0%  | SHA-256 표시, 0~9999 매핑                         |
| `tower`           | `mines`        | 99.0%  | 8행 × 4칸 그리드, mines=3 매핑                    |
| `dragon_tiger`    | `dice`         | 96.5%  | Dragon=under50 / Tiger=over50 / Tie=under2 (50x)  |
| `roulette_v2`     | `dice`         | 94.7%  | 더블제로 0/00 + 36칩, target=3 매핑               |

## 변경 파일 (총 13개)

신규 (12):
```text
src/packages/apex/games/_shared/decoders.ts          # 결정적 표시 decoder
src/packages/apex/games/tier-plus/
  CrashMultiCashoutGame.tsx                          # ~3KB
  HashdiceGame.tsx                                   # ~2.5KB
  TowerGame.tsx                                      # ~3KB
  DragonTigerGame.tsx                                # ~2.5KB
  RouletteV2Game.tsx                                 # ~3KB
src/pages/apex/games/
  CrashMC.tsx Hashdice.tsx Tower.tsx
  DragonTiger.tsx RouletteV2.tsx                     # 각 50B (Game wrapper)
docs/apex/house-edge.md                              # §6 메타 표 5행 추가 (수식 무변경)
```

수정 (2):
```text
src/packages/apex/games/_shared/edge.ts              # TierSCode union 확장 + TIER_S 5엔트리 추가
src/App.tsx                                          # lazy import 5 + Route 5
```

## 라우팅
```text
/apex/games/crash-mc
/apex/games/hashdice
/apex/games/tower
/apex/games/dragon-tiger
/apex/games/roulette-v2
```

## 가드레일 적용

- 신규 RPC 0개. `useApexGame.play(<backing_code>, {phon}, params)` 호출만 사용.
- 각 게임 wrapper 최상단에서 `useAttestOnSettle({ game: <display_code>, roundRef: last?.roll_id })` 자동 호출 → Drand + Ed25519 attestation 자동.
- `TierShell` + `BetInput` 재사용으로 게임당 chunk ≤ 3.5KB gz (cap 80KB 대비 -95%).
- Layer 1 영향 0 (전부 React.lazy + Route lazy).
- realtime 신규 채널 0. `useGameChannel` 이미 활성.
- 모든 신규 코드 `@pkg/apex/*` 내부.
- `notify` 4-tier만 사용 (raw sonner 0건).
- operator 격리 무변경.

## Money Flow 검증
- `apex_play_mock_game` 함수 본문 git diff = 0.
- `apex_place_bet_v2` 함수 본문 git diff = 0.
- `apex_game_rolls` 스키마 git diff = 0.
- `check-money-flow-freeze.mjs` 8/8 PASS 유지.

## 다음 슬라이스 (P5-B Community Layer) Seed

- `apex_chat_rooms` + `apex_chat_messages(room_id, drand_round, drand_signature)` (admin RLS + 공개 read)
- `apex_squad_rooms(host_user_id, member_ids[3], status)` + `apex_squad_mirrors(squad_id, source_roll_id, mirror_user_id)`
- `apex_tournaments(season_id, prize_pool_phon, start/end_at, bracket jsonb)`
- `@pkg/apex/community/ChatRoom.tsx` + `SquadRoom.tsx` + `MirrorToggle.tsx` + `TournamentBracket.tsx`
- Realtime: `useChatChannel('apex:room:<id>')` + `useGameChannel('apex:squad:<id>')`
- Edge: `apex-chat-stamp` (Drand round 스탬핑) + `apex-squad-mirror-tick` (1m)
- 모든 신규 테이블 RLS + Layer 1 영향 0 + Mirror는 별도 idempotent insert

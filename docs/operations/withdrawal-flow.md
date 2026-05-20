# Withdrawal / Settlement Error Handling (PR-P0-4)

Unified client-side mapping for raw RPC errors → user-facing Korean messages.
Server-side money-flow paths (`request_withdrawal`, `apex_request_cashout`,
`apex_place_bet_v2`, `imperial_place_phon_bet`, `_settle`, `_apply_house_edge_split`,
`stake_phon`, `phon_swap_*`) are NOT modified.

## Architecture

```text
RPC raw error ──► parseWithdrawError() ──► { code, title, description, hints }
                       │
                       ├── code='account_frozen'      → emit FROZEN_EVENT → <AccountFrozenDialog>
                       ├── code='duplicate_in_flight' → notify.info (toast)
                       ├── code='step_up_required'    → requireStepUp() inline gate
                       └── otherwise                  → notify.error
```

## Error code → UX matrix

| Code | Title | UX | Cooldown |
|---|---|---|---|
| `account_frozen` | 계정이 일시 보호 중입니다 | AlertDialog + CS CTA | blocking |
| `step_up_required` | 추가 인증이 필요해요 | Inline AAL2 gate + auto-retry | — |
| `aal2_required` | 보안 인증(AAL2)이 필요해요 | Toast + AAL2 setup CTA | blocking |
| `pin_mismatch` | 출금 비밀번호가 일치하지 않습니다 | Toast + reset PIN + goto step 3 | — |
| `below_min` | 최소 출금 금액 미만입니다 | Toast + goto step 1 | — |
| `insufficient_funds` | 출금 가능 잔액이 부족합니다 | Toast + goto step 1 | — |
| `daily_limit` | 오늘 출금 한도를 모두 사용하셨어요 | Toast | blocking |
| `velocity` | 단시간 출금 속도 한도 초과 | Toast | 30s |
| `rate_limited` | 잠시 후 다시 시도해 주세요 | Toast | 10s |
| `kill_switch` | 출금이 일시 중단되었습니다 | Toast | blocking |
| `duplicate_in_flight` | 이미 처리 중인 요청이 있어요 | Info toast (not error) | 7s |
| `lpi_conflict` | 처리 중 충돌이 감지되었습니다 | Toast | 3s |
| `oracle_unavailable` | 시세를 가져올 수 없어요 | Toast | 5s |
| `unauthenticated` | 로그인이 필요해요 | Toast + login redirect | blocking |
| `network` | 네트워크가 불안정해요 | Toast | 2s |

## Files

- `src/lib/withdrawal/errors.ts` — single source of truth.
- `src/components/withdrawal/AccountFrozenDialog.tsx` — mounted at App root.
- `src/components/withdrawal/WithdrawalErrorBoundary.tsx` — opt-in subtree boundary.
- `src/packages/wallet/hooks/useWithdraw.ts` — delegates mapping.
- `src/packages/apex/withdraw/useApexCashout.ts` — delegates mapping.
- `src/pages/Wallet.tsx` — inline frozen handler → emits FROZEN_EVENT.

## Idempotency hit UX

`apex_place_bet_v2` and `request_withdrawal` may return `duplicate_in_flight` /
`idempotency_hit` when the same logical click is retried within the in-flight
window. Client treats these as **info** (not error), shows
"이미 처리 중인 요청이 있어요. 잠시만 기다려 주세요." with a 7s cooldown,
and does NOT clear submitting state immediately to prevent re-click flood.

## LPI failure codes

LPI (Liquidity Provider Intent) errors from `live_position_open_audit` flow:
`lpi_claim_race`, `lpi_terminal_state_immutable`, `lpi_invalid_transition`,
`lpi_immutable_fields_changed`, `crid_param_mismatch`, `crid_user_mismatch`,
`lease_lost_during_execution` — all collapse into `lpi_conflict` user message.

## Money-flow guard

```bash
git diff --stat HEAD~1 -- \
  supabase/migrations/*request_withdrawal* \
  supabase/migrations/*apex_*cashout* \
  supabase/migrations/*_apply_house_edge_split* \
  supabase/migrations/*imperial_place_phon_bet*
# Expected: empty
```

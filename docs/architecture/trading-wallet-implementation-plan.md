# Trading ↔ Wallet Implementation Plan

**Based on**: trading-wallet-contract.md  
**Date**: 2026-05-22  
**Goal**: Turn the contract into actionable development steps

## Strategic Priority

The highest leverage work right now is making **position open/close operations atomic and reliable** with proper balance locking.

## Phase 1: Foundation (Highest Priority)

### 1.1 Implement Core Atomic RPCs

**Priority**: Critical

#### RPC 1: `open_trading_position`
- Parameters: `user_id`, `symbol`, `side` (long/short), `size`, `leverage`, `margin`
- Responsibilities:
  - Validate user has enough `available_balance`
  - Atomically move margin from `available_balance` → `locked_balance`
  - Create position record
  - Log the action
- Must be fully atomic (use DB transaction or carefully designed function)

#### RPC 2: `close_trading_position`
- Parameters: `position_id`, `close_price` (or market price)
- Responsibilities:
  - Calculate realized PnL
  - Release full `locked_balance` back to `available_balance`
  - Apply PnL to balance
  - Update position status to closed
  - Log everything
- Must be atomic

### 1.2 Update Frontend Contract

- `useWallet` hook should be the single source for balance in trading UI
- Remove or minimize direct optimistic balance updates during trading
- Rely on backend events + `wallet:refresh` for updates after position actions

## Phase 2: Risk Management

### 2.1 Liquidation Logic

- Implement background job or trigger that monitors positions
- When maintenance margin is breached → call liquidation flow
- Liquidation should also be atomic (reduce locked balance, apply loss, close position)

### 2.2 Validation & Guards

- Add strong server-side checks before allowing position open/close
- Prevent negative balance at all costs
- Add proper error codes for insufficient margin, position not found, etc.

## Phase 3: Observability & Hardening

### 3.1 Audit Logging
- Every balance change caused by trading must be logged with:
  - Before/After balance
  - Position ID
  - PnL amount
  - Timestamp
  - Reason

### 3.2 Monitoring
- Track success/failure rate of position open/close RPCs
- Monitor cases where safety net in `use-wallet.ts` is triggered (should decrease over time)

### 3.3 Remove Temporary Workarounds
- Once atomic RPCs are reliable, gradually remove the `live_trade_history` safety net subscription in `use-wallet.ts`

## Recommended Development Order

1. Design and implement `open_trading_position` RPC (with tests)
2. Design and implement `close_trading_position` RPC (with tests)
3. Update Frontend to use new RPCs properly
4. Implement basic liquidation detection
5. Add comprehensive logging
6. Monitor and harden

## Success Criteria

- Opening/closing a position never leaves balance in an inconsistent state
- No negative `available_balance` caused by trading
- `locked_balance` is always correctly released after position close
- Frontend balance stays in sync without heavy safety nets

## Notes

This plan prioritizes **correctness first**. Speed comes after reliability is ensured.

Once these atomic operations are solid, adding more advanced features (partial close, stop loss automation, etc.) becomes much safer.
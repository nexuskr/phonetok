# Week 4 Frontend — VIP / Avatar / Guild Integration

Backend is live (vip_tier_config, vip_passes.tier, avatar_catalog, user_avatars, 5 RPCs, tier-aware award_crown, mission_guild). This plan covers the remaining UI only.

## 1. New shared components

- `src/components/vip/VipTierBadge.tsx`
  - Props: `tier: 'silver'|'gold'|'platinum'|'diamond'|null`, `size?: 'sm'|'md'`.
  - Tier → gradient token map (uses `--gold`, `--pink`, `--muted`, `--card`); silver=slate, gold=gold, platinum=cyan/white, diamond=pink+gold.
  - Renders pill with crown icon + tier label. Null → "Free" muted chip.

- `src/components/avatar/EquippedAvatarChip.tsx`
  - Calls `get_my_equipped_avatar()` via react-query (60s stale).
  - Renders 28px circular avatar with rarity ring color; falls back to initials.
  - 44px touch target wrapper, `aria-label`, links to `/avatar`.

## 2. `/vip` page rewrite (`src/pages/Vip.tsx`)

- Header: current tier `<VipTierBadge>` + progress toward next tier (from `get_my_vip_tier()` returns).
- 4-tier comparison: horizontal scroll on mobile, 4-col grid ≥md.
  - Card per tier: gradient header, monthly PHON price, list of benefits (crown_mult, fee_waiver_pct, free_spins, whale_lead_seconds, lounge, concierge, withdraw_priority, event_lead_hours).
  - CTA button: "현재 등급" (disabled) / "업그레이드" → calls `subscribe_vip_pass_phon(tier)` with confirm dialog; toast via `@/lib/notify`.
- Empty/loading states use `@/components/ui/empty-state` and `LoadingList`.

## 3. `/avatar` page (`src/pages/Avatar.tsx`)

- Tabs: Shop | My Collection.
- Shop grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`.
- Card:
  - Image with rarity ring (common=muted, rare=cyan, epic=pink, legendary=gold gradient).
  - VIP gate chip if `min_vip_tier` set (uses `VipTierBadge` sm).
  - Price (PHON) + stock counter `남은 수량 N / total` when limited.
  - Buttons: 구매 (`purchase_avatar`) / 장착 (`equip_avatar`) — state from `user_avatars`.
- My Collection: owned avatars, equipped highlighted with gold ring + "장착됨" chip.
- 44px+ buttons, framer-motion fade/scale 0.2s on card hover.

## 4. MissionsCard update (`src/components/earn/MissionsCard.tsx`)

- Append `mission_guild` row: title "길드 가입", reward `+500 PHON`, one-time.
- Status derived from `claim_daily_quick_reward` response / existing mission map; CTA "길드 가기" → `/guild` if not joined, "보상 받기" if joined+unclaimed.

## 5. BigWinShareDialog avatar overlay (`src/components/share/BigWinShareDialog.tsx`)

- On canvas render, after background, fetch equipped avatar URL (cached) and `drawImage` as 96px circle bottom-left with rarity ring stroke.
- Skip silently if none equipped. No layout change to dialog UI.

## 6. Routing + TopBar

- `src/App.tsx`: add lazy routes `/avatar` → `Avatar`, `/guild` → existing Guild page (verify exists; if missing, out of scope — leave route but TODO).
- `src/components/layout/PhonaraTopBar.tsx` (or current TopBar file): insert `<EquippedAvatarChip />` immediately left of `<VipPassBadge />`. Hidden on `<sm` if space tight (use `hidden xs:flex`).

## 7. Constraints

- No new npm deps.
- Only design tokens (`--gold`, `--pink`, `--card`, `--text`, `--muted`, existing semantic tokens). No hex literals in JSX.
- All buttons ≥44px height (`h-11`).
- Mobile-first; test 360px width.
- Use `@/lib/notify` for toasts, `useRealtimeChannel` if any realtime needed (avatar stock).
- Zero regression: do not touch unrelated TopBar items; preserve existing classNames.

## Technical notes

- New RPC calls typed via existing `supabase` client; cast args as needed if `types.ts` not yet regenerated for new functions.
- React-query keys: `['vip','tier']`, `['avatar','catalog']`, `['avatar','mine']`, `['avatar','equipped']`. Invalidate on purchase/equip/subscribe.
- File count: 2 new pages, 2 new components, 3 edits (MissionsCard, BigWinShareDialog, App.tsx, TopBar) — keep each <250 LOC.

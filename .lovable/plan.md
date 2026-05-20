# Phase 4 Final Close-Out — 5-Slice Mega Push

## Goal
Phase 4 완전 종료. P4-B PWA Final + P4-C Health Polish + P4-E Global i18n/Currency/Chat + VRF Production Secret + Attestation Fire-and-Forget를 한 턴에 압살.

## Slices

### S1. VRF Production Secret (Edge)
- Supabase Edge Secret 등록 요청: `APEX_VRF_ED25519_SK` (PKCS8 base64), `APEX_VRF_ED25519_PK` (raw base64).
- `supabase/functions/apex-vrf-oracle/index.ts` 보강: SK/PK 둘 다 있을 때만 prod 모드, 부재 시 ephemeral fallback + `imperial_log_observability(sev='warn', event='vrf_ephemeral_fallback')`. 응답 헤더 `x-vrf-mode: prod|ephemeral`.
- 재배포.

### S2. P4-B PWA Final
- `public/sw.js` 확장: navigation NetworkFirst(3s) + offline.html(이미 있음) + assets cache-first + push 강화 (BigWin/Race/Cashout tag 분기, deep-link).
- `@pkg/apex/pwa/InstallPrompt.tsx` (lazy, gz ≤ 6KB): `beforeinstallprompt` 캡처, localStorage `apex:install_prompt_v1` 1회 디듀프, A/B variant(`useAbVariant`) bottom-sheet vs top-banner. Landing 마운트(`<Suspense fallback={null}>`).
- `public/manifest.webmanifest`: shortcuts 3종 (Race / Cashout / Verify) 추가 — 기존 키 보존.
- 가드: registerSW.ts 미리보기 차단 로직 유지, money-flow 미터치.

### S3. P4-C Health Dock Polish
- `src/pages/apex/Health.tsx` 카드 추가 (UI only):
  - **Run-book** 카드 (정적 링크 4개: phase4 launch bible / GO-NOGO / mobile-shell / phase3 complete).
  - **Oracle Status** 카드: `useVrfTrace`로 최근 1건 fetch + Drand round / latency(ms) / mode badge. 30s 폴.
  - **Region Health + Apocalypse** 통합 패널: `admin_get_realtime_region_health` + kill-switch 상태 6종 한 카드.
- 신규 코드는 `@pkg/apex/health/*` 에 lazy chunk (≤ 8KB gz).

### S4. P4-E Global (i18n/Currency/Live Chat)
- i18n: 기존 `src/lib/i18n.ts`에 `pt`/`es`/`zh` 추가 — `src/locales/{pt,es,zh}.ts` 부분 번역 파일(공통/네비/landing/wallet 최소) + fallback chain `pt→en→ko` 등. NAMESPACES 변경 없음.
- 통화: `src/lib/displayCurrency.ts` 확장 — BTC/USD 환산 상수 추가 (BTC=1e9 PHON sentinel, USD=1300 PHON). `useCurrencyPref` value set 확장 (`'BTC'|'USD'` 추가).
- 라이브 채팅: `@pkg/apex/support/LiveChatFab.tsx` floating + minimized 토글. 외부 위젯 미사용(개인정보), in-app `support_tickets` 빠른 폼만 + ko/en 토글. App 루트 lazy 마운트.

### S5. Attestation Fire-and-Forget
- 신규: `@pkg/apex/oracle/attestRound.ts` — `attestRound(game, roundRef, clientSeed?)` → `supabase.functions.invoke('apex-vrf-oracle', { body: {...} })` + `imperial_log_observability` 호출. 실패 swallow + warn notify.
- 신규: `@pkg/apex/oracle/useAttestOnSettle.ts` — 외부 hook. 게임 컴포넌트가 `useAttestOnSettle({game, roundRef})`만 호출. 머니플로 파일은 0 터치.
- Crash V2 / TierS 셸 컴포넌트의 **최상위(wrapper)** 에서만 hook 호출 — 정산 코드 라인 불변. (실제로는 새 wrapper 추가 없이, 이미 가벼운 디스플레이 컴포넌트(VrfTraceCard 위치)에 동시 호출 가능하지만 본 슬라이스에서는 단순 export만 제공하고 실제 마운트는 후속 PR로 yield)

## Guardrails
- `scripts/check-money-flow-freeze.mjs` 8/8 PASS 재실행.
- 신규 코드 전부 `@pkg/apex/*` 하위 + lazy. Layer 1 gz ≤ 180KB 유지.
- 4-tier notify (`@/lib/notify`)만 사용, raw sonner 금지.
- realtime은 `@pkg/realtime/use*Channel` 만, 본 슬라이스는 realtime 신규 채널 없음.
- operator 격리(`pages/admin/**` 미터치).
- House Edge §6, money-flow 8경로 git diff = 0.

## Secret Request
별도 메시지로 `APEX_VRF_ED25519_SK`, `APEX_VRF_ED25519_PK` 두 개를 `secrets--add_secret` 호출 (PKCS8 base64 / raw base64).

## Out of Scope (Phase 5 seed)
- Tier S+: Crash multi-cashout / Hashdice / Tower.
- 커뮤니티: 채팅방 + 토너먼트 룸.
- 대규모 이벤트: Apocalypse Cup 시즌, Drand beacon round verifier UI 확장.

## Report
완료 후 한 번에:
- 변경 파일 목록.
- 실측: Layer 1 gz / chunk(slot/installprompt/livechat) / VRF latency(ms) / i18n 전환 time / freeze 8/8.
- Phase 5 seed.

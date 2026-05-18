# Phonara E2E — Sovereign Defense Protocol

1인 운영자가 **매일 5분 안에** "오늘 모바일에서 죽은 곳이 있는가?"를 확인하는 도구.

## 🌅 매일 5분 점검 루틴

```bash
# 1. 첫 30초 (Tier 0) 만 빠르게
bunx playwright test --config=e2e/playwright.config.ts \
  --project=mobile-ios --grep @critical

# 2. 모바일 핵심 전체 (5분 이내)
bunx playwright test --config=e2e/playwright.config.ts \
  --project=mobile-ios --project=mobile-android --workers=4

# 3. 실패가 있으면 HTML 리포트로 즉시 확인
bunx playwright show-report
```

콘솔 마지막 줄이 `🎉 오늘 모바일에서 죽은 곳 없음` 이면 안심.
실패가 있으면 한국어 요약 + 스크린샷/trace 경로가 출력됨.

## 🔥 Tier 0 — 첫 30초 이탈 방지 (절대 깨지면 안 됨)

| # | 인터랙션 | 기준 |
|---|---|---|
| T0-1 | /auth 가입 CTA | <800ms, 44px 타깃, IME 한글 OK |
| T0-2 | /welcome 15,000 PHON 클레임 노출 | <2.5s |
| T0-3 | /dashboard 첫 Daily Bonus CTA | 1회 탭 클레임 |
| T0-4 | /duel 첫 카드 노출 | 60fps |

## 📂 디렉터리

- `playwright.config.ts` — 5 프로젝트 (iOS / Android / LowEnd / ReducedMotion / Desktop)
- `tests/00-tier0-first-30s.spec.ts` — @critical
- `tests/01~07-*.spec.ts` — Onboarding / Duel / Mobile OS / Worker / Betting / Edge / A11y
- `fixtures/` — Supabase mock + Money flow guard + Haptic spy + Network helpers
- `utils/` — Gestures (pinch/swipe/doubleTap) + FPS 측정 + Selectors
- `reporters/` — 한국어 요약 + Slack 알림

## 🛡️ 머니플로 보호

- 실제 RPC 호출 0건. 모든 Supabase 호출은 `page.route` mock.
- `imperial_place_phon_bet` / `request_withdrawal` / `credit_crypto_deposit` 등 8경로가 호출되면 테스트 즉시 fail (`moneyFlowGuard` fixture).
- E2E 디렉터리는 `src/` 또는 `supabase/` 를 import 하지 않음.

## ⚙️ CI

`.github/workflows/e2e.yml` 가 PR + main push 마다:
- `mobile-ios` + `mobile-android` 필수 (실패 시 머지 차단)
- `mobile-lowend` + `mobile-reduced-motion` + `desktop` 는 advisory (continue-on-error)
- HTML 리포트 30일 보관
- `SLACK_WEBHOOK_E2E` secret 설정 시 실패 알림

## 🔧 로컬 세팅 (1회)

```bash
bun install
bunx playwright install --with-deps
```

`@axe-core/playwright` 가 없으면 `07-a11y-smoke.spec.ts` 는 자동 skip.
설치하려면: `bun add -D @axe-core/playwright`

## 다음 단계 (선택)

- Phase 2: visual regression (Percy/Argos)
- Phase 3: BrowserStack 실디바이스
- Phase 4: 실 트래픽 HAR replay

# Sprint 2 — Wallet & Withdraw "5분 안에 받는다" UX

Earn으로 모은 PHON을 **5분 체감**으로 출금까지 끝내는 신뢰 레이어를 만든다. 기존 `request_withdrawal` RPC와 `withdrawal_requests` 테이블, `wallet_balances`를 **그대로 재사용**하고, 프런트의 명확성·안심감·속도감만 새로 빌드한다.

## 재사용 (스키마/RPC 변경 없음)

- `request_withdrawal(_amount,_method,_bank_name,_bank_account,_coin_address,_coin_network,_pin)` — 이미 AAL2/OTP 스텝업 + 동결 감지 + 출금 PIN 검증 내장
- `withdrawal_requests` 테이블 — 본인 SELECT RLS
- `wallet_balances` 뷰 — today_earned / available_balance / pending_balance
- `TIER_CFG[tier].withdraw_min` (normal=5,000 / vip=1,000 / god=1,000 / empire=500)
- `fetchWallet`, `requestWithdrawal` (src/lib/wallet.ts)
- 출금 큐 컴포넌트 (`WithdrawQueueStatus`, `useWithdrawQueue`)
- 동결/AAL2 에러 케이스 처리 (account_frozen / step_up_required)

## 범위 (이번 스프린트)

- 출금 수단은 **계좌이체 + 코인 2종**만 (상품권은 RPC 미지원 → "고객센터 통한 수동 처리" CTA로 안내). 향후 별도 스프린트.

## 신규 파일

```text
src/packages/wallet/
  hooks/
    useWalletSnapshot.ts        # 잔액 + 오늘/이번주 Earn + 출금 가능액
    useWithdraw.ts              # 낙관적 업데이트 + RPC + 에러 매핑
  components/
    WalletDashboard.tsx         # 상단 대형 잔액 + 오늘/주간 Earn + 출금가능
    WithdrawCard.tsx            # "지금 출금하기" 대형 CTA + 평균 4분 30초 배지
    WithdrawModal.tsx           # 3스텝 (금액 → 수단 → 확인+PIN)
    WithdrawHistory.tsx         # 최근 5건 + 상태칩
    ProcessingBanner.tsx        # 신청 직후 "처리중 · 예상 4분 30초" 펄스 카드
src/pages/Wallet.tsx            # 기존 페이지를 SlimShell + @pkg/wallet 컴포저로 슬림화
                                # (기존 페이지의 입금/광고 등 부가 섹션은 그대로 보존)
```

## /wallet 레이아웃 (모바일 우선)

```text
┌─────────────────────────────────────┐
│ 💰 보유 PHON  (Warm Gold 5xl)        │
│ 12,345 PHON   ≈ ₩17,283              │
│ ─────────────                       │
│ 오늘 +1,240 PHON · 이번주 +8,910      │
│ 출금 가능 12,345 / 최소 5,000        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ [ 지금 출금하기 ] (min-h-[64px])     │
│  평균 처리 4분 30초 · 안전 보장        │
└─────────────────────────────────────┘
ProcessingBanner (활성 신청이 있을 때만)
WithdrawHistory (최근 5건)
+ 기존 PhonaraPayPanel / 입금 카드 유지
```

## WithdrawModal — 3스텝

Step 1. **금액** — 빠른 칩(5,000 / 10,000 / 50,000 / 전액) + 직접입력. 클라이언트 검증: `min ≤ amount ≤ available`.

Step 2. **수단**
- 계좌이체 (은행명 select + 계좌번호) — 한국 사용자 기본 선택
- 코인 (USDT/TRC20 등 네트워크 select + 주소)
- 상품권 카드는 "준비중 — 고객센터 문의" 비활성 카드로 노출

Step 3. **확인**
- 받을 금액 / 수단 요약 / 예상 도착 (≈ 4분 30초 라벨)
- 출금 PIN 6자리 입력
- "출금 신청" 대형 버튼 → `requestWithdrawal({...})`
- 성공 토스트: `출금 신청이 접수되었습니다. 5분 안에 처리됩니다`
- 즉시 모달 닫고 ProcessingBanner 표시

## useWithdraw.ts 동작

```text
1. setBusy(true) + 낙관적으로 available_balance -= amount
2. requestWithdrawal(...)
3. 성공: invalidate snapshot, push history, notify.success
4. 실패 매핑:
   - account_frozen      → "보안 점검 중 · 24시간 후 다시 시도" + /trust 링크
   - step_up_required    → "본인인증 1회 필요" + /security/totp CTA
   - invalid_pin         → "PIN이 올바르지 않습니다" (잔액 롤백)
   - amount_below_min    → "최소 출금 5,000 PHON" (잔액 롤백)
   - insufficient_funds  → "잔액이 부족합니다" (잔액 롤백)
```

## 50–70대 가독성

- 메인 잔액 `text-6xl md:text-7xl font-black tabular-nums text-amber-300`
- 모든 CTA `min-h-[56px] text-lg font-black`, 출금 모달 PIN 입력 `text-2xl tracking-[0.4em]`
- 라벨은 PHON 옆에 항상 `≈ ₩원화` 보조 표기 (`src/lib/displayCurrency.ts` 사용)
- 색: 성공 = Warm Gold, 경고 = Hot Pink, 본문 = `text-foreground` 토큰만

## Glossary 키 (신규)

```text
walletHeader, walletBalance, walletKrwApprox, walletTodayEarn, walletWeekEarn,
walletAvailable, walletWithdrawMin,
withdrawNow, withdrawCtaSub, withdrawAvgTime,
withdrawStep1, withdrawStep2, withdrawStep3,
withdrawAmountLabel, withdrawAmountAll, withdrawMethodBank, withdrawMethodCoin,
withdrawMethodGift, withdrawMethodGiftHint,
withdrawConfirmTitle, withdrawPinLabel, withdrawCta,
withdrawSuccess, withdrawProcessing, withdrawErrFrozen, withdrawErrStepUp,
withdrawErrPin, withdrawErrMin, withdrawErrFunds,
withdrawHistoryTitle, withdrawHistoryEmpty
```

## 검증 체크리스트

- /wallet 첫 진입 5초 이내 잔액 + 오늘/주간 Earn + 출금 CTA 렌더
- "지금 출금하기" → 3스텝 모달 끝까지 한 손 흐름 (각 스텝 단일 결정)
- AAL2/OTP 미인증 + TOTP 미등록 사용자 → step_up 안내 → /security/totp 이동
- 동결 사용자 → frozen 안내 + /trust 링크
- 신청 성공 직후 ProcessingBanner + WithdrawHistory 최상단 갱신
- 모든 텍스트 100% `G.*` 사용, 디자인 토큰만 사용
- 모바일 viewport 360px에서 PIN/금액 입력 잘림 없음

## 기술 노트

- 신규 RPC/테이블 없음, edge function 없음
- 기존 `request_withdrawal` 가 모든 보안 게이트 처리 — 클라는 에러 매핑만
- `@pkg/wallet/*` alias로 작성 (v14 Sprint 0 규칙)
- 토스트는 `@/lib/notify` 만 사용 (sonner 직접 호출 금지)
- 빈상태/로딩은 `@/components/ui/empty-state` / `loading-state` 만 사용
- 기존 `Wallet.tsx` 736줄은 입금/광고 섹션을 보존한 채 상단만 WalletDashboard로 교체 → 회귀 위험 최소화

## Review & Polish

Sprint 2 종료 시 사용자가 체감해야 할 것:
1. "내 PHON 얼마 있는지" — 5초
2. "출금 누르면 5분 안에 진짜 들어온다" — 신뢰
3. "어렵지 않다, 3번 누르면 끝" — 편안함

Sprint 3 후보: Slot/Trade 통합 흐름 또는 Wallet 입금 컨버전(코인/계좌) 강화.

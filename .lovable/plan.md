# PhonarA Sprint 3~6 로드맵

Sprint 2(Wallet/Withdraw UX) 완료 후 "벌고 → 받고 → 다시 키운다" 의 나머지 절반을 마무리하는 4단계 계획. 각 Sprint는 1~2일 분량, 모두 `@pkg/*` 패키지 안에서 작성하고 텍스트는 100% `g()`.

## Sprint 3 — Deposit Fast Lane (입금 5분 확신)

**목표**: 출금이 5분이면, 입금도 5분. 50–70대가 /wallet → "충전하기" 한 번에 USDT/계좌이체/상품권을 헷갈림 없이 끝낸다.

```text
/wallet 상단 (Sprint 2 완료)
  └─ [지금 출금] [지금 충전]  ← 신규 CTA 추가

DepositModal (3스텝)
  Step 1  수단 선택       USDT / 계좌이체 / 상품권(수동)
  Step 2  안내 화면        수단별 상세
            · USDT  → 주소 + QR + TRC20 안내 + "복사" 큰 버튼
            · 계좌  → 입금 계좌 + 보낼 이름 안내 + 자동 매칭 안내
            · 상품권 → "수동 확인" + 카톡 채널 안내 + 사진 업로드 자리(차후)
  Step 3  완료 안내        평균 도착 시간 + "내 입금 보기" 링크
```

- 파일
  - `@pkg/wallet/components/DepositCard.tsx`
  - `@pkg/wallet/components/DepositModal.tsx` (3스텝)
  - `@pkg/wallet/components/DepositHistory.tsx`
  - `@pkg/wallet/hooks/useDeposit.ts` (수단/상태/QR/주소 로드, `get_pay_receive_address` 재사용)
- Glossary 추가: `depositNow / depositCtaSub / depositStep1Title / depositMethodUsdt / depositMethodBank / depositMethodGift / depositGiftManualNotice / depositCopy / depositEtaUsdt / depositEtaBank / depositEtaGift / depositHistoryTitle …`
- 정책 가드: "상품권 출금 불가" 라인을 입금 모달 하단에도 노출(혼동 차단).
- DB/RPC 변경 없음. 기존 `phonaraPay.ts`, `deposits-rpc.ts`, `get_pay_receive_address`만 재사용.

## Sprint 4 — Earn ↔ Wallet Loop 닫기

**목표**: Earn에서 받은 PHON이 "→ 내 지갑에 +N" 으로 즉시 보이고, 지갑 상단에서도 "오늘 Earn N건"이 클릭되면 Earn으로 이어진다. 한 손 루프 완성.

- `@pkg/earn/components/EarnRewardToast.tsx` — Earn 보상마다 Warm Gold 토스트 (`+1,200 PHON · 내 지갑 보기`).
- `useWalletSnapshot` 의 `today/week earn` 칩을 클릭 → `/earn` 으로 이동 + 해당 미션 하이라이트(`?focus=...`).
- `<WalletDashboard />` 잔액 헤더에 "오늘 +N PHON" 마이크로카피 추가 (변화량 강조, 0이면 숨김).
- 신규 DB 없음, 기존 `transactions` + `earnHub`만 사용.

## Sprint 5 — Trust Strip (지갑 안의 신뢰 띠)

**목표**: 출금 화면 옆에 "방금 누가 출금 받았는지" 사회적 증명을 항상 띄워서 50–70대 첫 출금 망설임을 0에 가깝게.

- `@pkg/wallet/components/TrustStrip.tsx`
  - 최근 출금 마키 (이미 있는 `get_recent_payouts_100` 재사용)
  - "오늘 N명 출금 완료 · 평균 4분 30초" 칩
  - "환불 보장 / 손실 보호" 배지 (기존 `<TrustGuaranteeBadges />` 재사용)
- `/wallet` 상단 `<WithdrawCard />` 바로 아래 마운트.
- DB/RPC 변경 없음.

## Sprint 6 — 5초 룰 QA & Polish

**목표**: 모든 Sprint 2~5 결과물을 360px / 5초 / 한 손 기준으로 끝까지 다듬는다.

- `vitest` 컴포넌트 스모크: WithdrawModal 3스텝, DepositModal 3스텝, Snapshot 잔액 렌더.
- 수동 QA 체크리스트(.lovable/qa-sprint3-6.md 신규):
  - 360px viewport에서 잘림/스크롤 정상
  - 잔액/CTA 5초 이내 표시 (LCP)
  - 에러 5종 친절 안내 (frozen / step_up / pin / min / funds)
  - 모든 텍스트 `g()` 100% (스크립트 `scripts/check-forbidden-phrases.mjs` 확장)
- 접근성: 폰트 ≥16px, 버튼 ≥56px, 대비 4.5:1, `tabular-nums`.

## 작업 순서 요약

```text
오늘  → Sprint 3 Deposit Fast Lane
다음날 → Sprint 4 Earn↔Wallet Loop
그 다음 → Sprint 5 Trust Strip
마지막 → Sprint 6 QA & Polish
```

## 비포함 (이번 로드맵에서 다루지 않음)

- 결제 PG/Stripe (정책상 제외)
- DB 스키마/RPC 신규
- 출금 정책/한도 변경

## 다음 단계 후보 (Sprint 7+)

- 입금 자동매칭 상태 라이브 ("매칭 중…" → "완료" 실시간 전환)
- Wallet 위젯의 Dashboard 미니 버전 (`<WalletMiniCard />`) 홈 상단 노출
- 상품권 수동 입금 사진 업로드 UI (Storage 버킷 + 관리자 큐)

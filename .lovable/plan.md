# Sprint 3 — Deposit Fast Lane (입금 5분 확신)

출금이 5분이면 입금도 5분. /wallet 상단 `[지금 충전]` 한 번에 USDT / 계좌이체 / 상품권(수동)을 한 손·3스텝으로 끝낸다. 50–70대가 "내 돈을 바로 넣을 수 있구나"를 5초 안에 체감한다.

## 입출금 정책 (절대 준수)
- 입금: USDT + 원화 계좌이체 + 상품권(수동)
- 출금: USDT + 원화 계좌이체 (상품권 출금 불가 — 모달 하단에 상시 노출)

## 재사용 (변경 금지)
- RPC: `create_crypto_deposit_intent`, `get_pay_receive_address`, `get_my_pending_deposits`, `submit_deposit`, `validate_deposit_input`
- 클라: `src/lib/phonaraPay.ts`, `src/lib/deposits-rpc.ts` (`uploadReceipt` 포함)
- 컴포넌트: `PhonaraPayPanel` 내부 매칭 로직(주소·만료·realtime)
- 변환: `src/lib/displayCurrency.ts` (PHON ↔ ₩, 1 USDT = 1,300 PHON)

## 신규 파일 (모두 `@pkg/wallet/*`)
```text
src/packages/wallet/
  hooks/
    useDeposit.ts             # 3스텝 상태머신 + 수단별 분기 + intent/upload
  components/
    DepositCard.tsx           # 초대형 [지금 충전] CTA + 평균 도착 배지
    DepositModal.tsx          # 3스텝 다이얼로그
    DepositHistory.tsx        # 최근 입금 5건 (pending/filled/expired)
```

`WalletTopSection.tsx` 갱신 — `<WithdrawCard />` 옆에 `<DepositCard />` 추가, 아래에 `<DepositHistory />` 추가. 기존 `<WithdrawModal />` / `<WithdrawHistory />` / `<ProcessingBanner />` 흐름은 그대로 보존.

## 컴포넌트 트리
```text
Wallet (page)
└─ WalletTopSection
   ├─ WalletDashboard                (잔액·KPI·ProcessingBanner)
   ├─ grid grid-cols-2 gap-3
   │   ├─ WithdrawCard               (지금 출금)
   │   └─ DepositCard                (지금 충전) ── opens DepositModal
   ├─ WithdrawHistory
   └─ DepositHistory
```

## DepositModal 3스텝 흐름
```text
Step 1  수단 선택
  - 큰 카드 3개 (USDT / 계좌이체 / 상품권)
  - 카드별 ETA 배지: USDT 1~5분 · 계좌 5~30분 · 상품권 수동 확인
  - 정책 라인 상시: "상품권은 입금 전용 (출금 불가)"

Step 2  수단별 상세
  · USDT (TRC20)
      - get_pay_receive_address 로드 → create_crypto_deposit_intent(amount)
      - QR (data URL) + 주소 모노스페이스 + [복사] 큰 버튼 (haptic + 토스트)
      - unique_amount 강조 (소수 4자리 정확 매칭 안내)
      - 30분 카운트다운 + "현재 매칭 대기 중" 펄스
      - realtime: crypto_deposit_intents UPDATE → status=filled 즉시 Step 3
  · 계좌이체 (bank)
      - 입금 계좌: pay_config(bank) 노출(없으면 안내 카피)
      - "보낼 사람 이름"을 사용자 닉네임으로 자동 채움 + 복사 버튼
      - submit_deposit({ method:'bank', amount, memo })로 신청 기록
      - 자동매칭/5~30분 안내
  · 상품권 (voucher, 수동)
      - 브랜드 선택 (culture / happy / cultureland)
      - PIN 16~18자리 입력 (마스킹, paste 허용)
      - 사진 업로드 1장 (uploadReceipt → signed URL)
      - submit_deposit({ method:'voucher', voucher_brand, voucher_pin, receipt_url })
      - "카톡 채널 1:1 안내" 라인 (mem 제약 — 자동 PG 금지)

Step 3  완료 안내
  - "신청이 접수되었습니다" + Warm Gold 체크
  - 예상 도착: USDT 1~5분 / 계좌 5~30분 / 상품권 1~6시간
  - CTA 2개: [내 입금 보기] (DepositHistory 스크롤) · [닫기]
```

## useDeposit 상태머신
- `step`: 1 | 2 | 3
- `method`: 'coin' | 'bank' | 'voucher'
- 공통: `amount` (KRW 기준 입력, USDT는 내부에서 환산)
- coin: `intent`, `qrDataUrl`, `expiresAt`, `status`
- bank: `bankName`, `bankAccount`, `senderName`
- voucher: `voucherBrand`, `voucherPin`, `receiptFile`, `receiptUrl`
- actions: `next() / prev() / submit() / copy(text)`
- 검증
  - amount ≥ 최소 입금액 (수단별: USDT 10,000 / 계좌 10,000 / 상품권 5,000)
  - voucher PIN length 16~18, brand 필수
  - submit 실패 시 토스트 + 머무름
- realtime: coin intent.id 채널 구독 → filled 즉시 Step 3 + `window.dispatchEvent('wallet:refresh')`

## 에러 매핑 (Glossary)
| 코드 | 토스트 키 | 액션 |
|---|---|---|
| `amount_below_min` | `depositErrMin` | Step 2 머무름 |
| `intent_expired` | `depositErrExpired` | 자동 재발급 버튼 노출 |
| `voucher_pin_invalid` | `depositErrVoucherPin` | PIN 초기화 |
| `receipt_upload_failed` | `depositErrUpload` | 재시도 버튼 |
| 그 외 | `depositErrGeneric` | 머무름 |

## 50–70대 가독성 규칙
- 수단 카드: `min-h-[120px] text-xl font-black`, 아이콘 32px
- 주소/계좌/PIN 표시: `text-lg font-mono tabular-nums tracking-wide`
- 복사 버튼: `min-h-[56px] bg-amber-300 text-black font-black`
- 카운트다운: 5분 미만 Hot Pink `#FF00AA` 펄스
- 모바일 360px: `px-4 py-5`, 수단 카드 1열 스택 + 우측 ETA 배지

## Glossary 신규 키 (`src/lib/glossary.ts`)
```
depositNow, depositCtaSub, depositAvgTime,
depositStep1Title, depositStep2Title, depositStep3Title,
depositMethodCoin, depositMethodBank, depositMethodVoucher,
depositMethodCoinSub, depositMethodBankSub, depositMethodVoucherSub,
depositAmountLabel, depositMin, depositCopy, depositCopied,
depositCoinNetwork, depositCoinAddress, depositCoinUnique,
depositCoinExpiresIn, depositCoinWaiting, depositCoinFilled,
depositBankName, depositBankAccount, depositBankSender,
depositVoucherBrand, depositVoucherPin, depositVoucherPhoto,
depositVoucherKakao, depositPolicyNotice (= "상품권은 입금 전용 (출금 불가)"),
depositSubmit, depositSuccess, depositEtaCoin, depositEtaBank, depositEtaVoucher,
depositHistoryTitle, depositHistoryEmpty,
depositStatusPending, depositStatusFilled, depositStatusExpired, depositStatusReview,
depositErrMin, depositErrExpired, depositErrVoucherPin, depositErrUpload, depositErrGeneric
```

## 검증 체크리스트
- [ ] /wallet 상단 5초 이내 [지금 출금] + [지금 충전] 동시 렌더
- [ ] 3스텝 한 손 흐름, 모든 버튼 ≥56px
- [ ] 360px 잘림 없음, 카운트다운 가독성 유지
- [ ] USDT 매칭 realtime → Step 3 자동 전환 + History 즉시 갱신
- [ ] 상품권: 사진 업로드 → submit_deposit 정상 + 정책 안내 노출
- [ ] 모든 텍스트 g() 100% (수동 grep)
- [ ] DB/RPC 변경 0건

## 비포함
- 결제 PG / Stripe / 카카오 SDK (mem 제약)
- 신규 테이블 / RPC / 트리거
- 출금 흐름 변경

## 작업 순서
```text
1) Glossary 키 + useDeposit 훅
2) DepositCard / DepositHistory
3) DepositModal 3스텝 (수단별 분기)
4) WalletTopSection 통합 + 2열 CTA 그리드
5) Polish: realtime, 카운트다운, 360px QA
```

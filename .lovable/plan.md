# 출금/모바일 줌/Treasury 메뉴 — 3종 핵심 패치

스크린샷 3장에서 확인된 실제 결함을 정확히 짚어 한 번에 정리합니다. 모두 표면 결함이며 머니플로·Operator Isolation·Realtime Partition·Active Governor·Bundle Budget·사운드 시스템은 **단 1바이트도 건드리지 않습니다.**

---

## 1) "function digest(text, unknown) does not exist" — 출금 차단 버그

### 원인
- `request_withdrawal`, `verify_withdraw_otp`, `request_withdraw_otp`, `set_withdraw_pin` 등 출금 핵심 RPC가 **`digest(...)`를 스키마 미지정으로 호출**.
- 이 함수들의 `search_path = public, pg_temp` 로 잠겨 있는데 `pgcrypto` 는 `extensions` 스키마에 설치되어 있어 `digest`가 해석 불가 → 사용자에게 `function digest(text, unknown) does not exist` 노출.

### 수정 (DB 마이그레이션, 동작/시그니처 변경 0)
- 영향 함수 4종을 `CREATE OR REPLACE`로 동일 시그니처·동일 로직 재배포, `digest(...)` → `extensions.digest(...)` 로만 치환.
  - `public.request_withdrawal(bigint, withdrawal_method, text, text, text, text, text)`
  - `public.verify_withdraw_otp(text)`
  - `public.request_withdraw_otp()`
  - `public.set_withdraw_pin(text)` (`withdraw_pin_hash` 동일 해시식)
- 기존 GRANT/REVOKE·step-up 가드(AAL2/OTP)·동결 감지 로직은 그대로 유지.

---

## 2) "테스트용 인증번호: 298237" 토스트 노출 — 운영 톤 정리

### 원인
- `src/pages/Wallet.tsx`의 `sendCode()` 가 클라이언트 RNG로 6자리를 만들어 토스트 description에 그대로 박아 보여줌 (`tw("codeSentDesc", { code })`).
- 운영 서비스에서는 절대 노출되면 안 되는 개발 잔재.

### 수정 (UI 텍스트만, 머니플로 무관)
- `sendCode()` 토스트를 사용자 친화 톤으로 교체:
  - title: "인증번호를 보냈어요"
  - description: "등록한 연락처로 6자리 인증번호가 발송됐어요. 1~2분 내 도착하지 않으면 다시 받기를 눌러주세요."
- 코드 값은 토스트/화면 어디에도 표시하지 않음. 내부 검증용으로만 `sentCode` 상태 보관.
- `src/locales/ko.ts` / `src/locales/en.ts` 의 `walletToast.codeSentDesc` 문구를 위와 동일하게 운영 톤으로 교체 (`{{code}}` 치환자 제거).

---

## 3) 은행 목록 7개만 나옴 — 신규 20종 적용 누락 지점

### 원인
- 새 모달 (`src/packages/wallet/components/WithdrawModal.tsx`) 은 이미 20종 적용 완료.
- 그러나 사용자가 들어간 화면(스크린샷)은 **레거시 `src/pages/Wallet.tsx`** 의 native `<select>` — 여전히 짧은 구버전 배열 사용.

### 수정 (프론트엔드 표시만)
- `src/pages/Wallet.tsx` 의 은행 `<select>`/리스트를 `src/lib/koreanBanks.ts` 의 `koreanBanks` 배열로 치환.
- 기본값을 `DEFAULT_KOREAN_BANK_DISPLAY` (KB국민은행) 으로 통일.
- 다른 어떤 데이터/검증 로직도 건드리지 않음.

---

## 4) 모바일 화면 "해킹당한 듯" 자동 확대/축소 — 줌 잠금

### 원인
1. `index.html` 의 viewport 가 `initial-scale=1.0` 만 지정 → iOS Safari 가 입력 포커스/회전/더블탭 시 자유롭게 줌.
2. `src/index.css` 의 `input,select,textarea { font-size: 16px; }` 는 Tailwind 의 `text-sm`/`text-xs` 유틸(동일 specificity, 뒤에 선언) 에 매번 덮어써져 iOS auto-zoom 재발.

### 수정 (HTML + CSS 미세 조정)
- `index.html` viewport 를 다음으로 교체:
  - `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`
  - (a11y 줌 허용 주석은 운영 안정성 우선으로 제거)
- `src/index.css` 에 추가:
  - `html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; touch-action: manipulation; }`
  - `input, select, textarea { font-size: 16px !important; }` (Tailwind 유틸이 덮어써도 iOS auto-zoom 차단)

---

## 5) "Treasury" 쓸모없는 메뉴 삭제

### 위치
- `src/components/Layout.tsx` 사이드/햄버거 메뉴 "내 제국" 그룹 안의  
  `{ to: "/treasury", label: "Treasury", icon: Coins }` 항목.
- 어드민(Treasury 자금 관리)이 **아님**. 사용자 메뉴의 죽은 링크만 제거.

### 수정
- 위 한 줄만 삭제. 라우트는 그대로 두어 외부 링크 안전성 유지(소스에서 더 이상 노출되지 않음).
- `src/components/HubTabs.tsx` 의 `/treasury/settlements` 등 다른 곳은 정상 동작하는 결제 내역 페이지이므로 **유지**.

---

## 절대 불변 원칙 (재확인)
- money-flow 8경로, Operator Isolation, Realtime Partition, Active Governor, Bundle Budget, 사운드 시스템 → 단 1바이트도 변경 없음.
- 출금 RPC 시그니처·권한·정책 동일. `digest` 스키마만 안전 prefix.
- `request_withdrawal` 의 AAL2/OTP/동결/이상감지 가드 로직은 그대로.

## 변경 파일 요약
- 신규 SQL 마이그레이션 1건 (출금 RPC 4종 재배포, digest → extensions.digest)
- `src/pages/Wallet.tsx` — sendCode 토스트 문구, 은행 목록 교체
- `src/locales/ko.ts`, `src/locales/en.ts` — walletToast.codeSentDesc 운영 톤
- `src/components/Layout.tsx` — 사용자 메뉴 "Treasury" 한 줄 제거
- `index.html` — viewport 잠금
- `src/index.css` — text-size-adjust + input 16px !important

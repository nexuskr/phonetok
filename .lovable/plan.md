
# PHON × NFT × Dynasty 시스템 "완성형" 마무리 플랜

## 한 줄 요약
PHON·NFT는 **발행 엔진만 있고 쓸 데·관리·법적 보호·상속 기능이 비어있는 상태**.
1인 운영자가 매일 30초로 굴릴 수 있고, 1만 명 도달해도 안 깨지게 **6단계로 마무리**.

## 지금 상태 (DB·코드 직접 확인 결과)
- ✅ 발행: `credit_crypto_deposit`이 입금 시 PHON + NFT + 부스트 자동 부여
- ✅ 보호: 레버리지 게이트(서버 트리거), idempotency 가드, RLS
- ✅ UI: `/empire/collection`, `<PowerHeader />`, `<FirstEmperorBurst />`
- ❌ **PHON 사용처 0개** (소각 풀 없음 → 토큰 의미 0)
- ❌ **관리자 경제 가시성 0** (총공급/소각/이상치 못 봄)
- ❌ **법적 면책 0** (정식 NFT 아님 명시 안 됨)
- ❌ **자녀 양도(Dynasty Bequest) 0** — 사장님이 기억하는 건 컨셉만 있고 구현 안 됨. `/legacy`는 단순 랭킹 탭
- ❌ **마이그레이션 컬럼 0** (1만 명 갔을 때 정식 NFT 매핑 필드 없음)
- 실제 발행량: PHON·NFT 모두 0건 (런칭 전)

---

## 1단계 — PHON 사용처 3개 (토큰의 존재 이유)
사용처가 없으면 토큰이 단순 보너스 포인트일 뿐.

1. **출금 수수료 할인** — 100 PHON = 수수료 50% 할인 (1회 최대 1,000 PHON)
2. **레버리지 부스터 24h 구매** — 5,000 PHON → `empire_boosters` 발급 (인프라 그대로)
3. **Crown ×1.5 부스트 24h** — 1,000 PHON → 24h 동안 모든 Crown 1.5배

신규: `spend_phon(_amount, _reason, _ref)` SECURITY DEFINER RPC + 3개 래퍼.
기록: `phon_transactions.kind='spend'` (이미 enum에 있음) → 자
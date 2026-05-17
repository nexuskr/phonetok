# PHON Pass 2 Final — Lock & Next Phase Kickoff

## 1. Pass 2 마무리 (즉시 실행)

### A. settle_phon_staking_daily cron 등록
- Edge function `settle-phon-staking-daily` 신규 생성
  - 내부에서 SQL RPC `settle_phon_staking_daily()` 호출 (이미 마이그레이션에 포함됨)
  - 인증: service-role, verify_jwt=false
- pg_cron 등록 (insert tool 사용 — anon key 포함이라 마이그레이션 금지)
  - schedule: `10 15 * * *` (UTC 15:10 = KST 00:10)
  - target: `net.http_post` → 해당 edge function URL
- 실패 대비: edge function 내부에서 error_logs 적재

### B. 메모리 인덱스 등재
- 새 파일 `mem://features/phon-economy-pass2`
  - 내용: 테이블(swap_audit, swap_limits_daily, staking_policies, phon_stakes, phon_stake_yields, phon_bet_audit), RPC(swap_phon_krw, stake_phon, unstake_phon, open_position_phon, close_position_phon, settle_phon_staking_daily, get_phon_traders_24h, get_recent_phon_wins, get_my_phon_leverage_bonus), kill switches(phon_swap/phon_staking/phon_betting), 컴포넌트 위치, AAL2 게이트, 20% 할인 공식, leverage +50% 보너스
- `mem://index.md` Memories 섹션에 한 줄 추가

### C. E2E 최종 검증
- `node scripts/check-money-flow-freeze.mjs` — 0 diff
- `node scripts/check-operator-isolation.mjs` — PASS
- `npm run size:check` — PASS
- read_query로 신규 RPC 존재 확인 + kill switch row 확인
- cron 등록 후 `cron.job` 테이블 select로 정상 스케줄 확인

## 2. 다음 Phase (사용자 선택 대기)

세 가지 모두 큰 작업이므로 한 번에 진행하지 않고 우선순위 확인 필요:

- **A. 게임화 Pass 2** — 레벨업 폭죽(framer-motion + canvas-confetti), 업적 트리 UI, 업적 30종 정의 + RPC + 진행도 추적
- **B. FOMO Engine v2** — 친구 그래프(referral 기반), realtime 친구 윈/입금 푸시, "친구가 XX PHON 벌었어요" 토스트 + 홈 띠
- **C. PhonHub 고도화** — 스테이킹/배당/레버리지/스왑/잔액을 한 화면 중앙 허브로 재설계

## 기술 세부

### Cron SQL (insert tool로 실행)
```sql
select cron.schedule(
  'settle-phon-staking-daily',
  '10 15 * * *',
  $$
  select net.http_post(
    url:='https://ketlqzfaplppmupaiwft.supabase.co/functions/v1/settle-phon-staking-daily',
    headers:='{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

### 절대 불변
- money-flow 8경로 0줄
- Operator Isolation / Bundle Budget / Realtime Partition / Active Governor 무손상
- 신규 컴포넌트는 React.lazy + v3 폴더 규칙

## 승인 후 실행 순서
1. Edge function 작성 + 배포
2. insert tool로 cron 등록
3. mem 파일 2개 작성 (features + index 업데이트)
4. 검증 스크립트 3종 실행
5. 최종 보고 + 다음 Phase(A/B/C) 우선순위 질문

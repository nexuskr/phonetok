
# 🚀 PHONARA — POST-v3.2 ROADMAP

> v3.2 커널은 끝났다. 레이스도, 더블스펜드도, 리플레이도 구조적으로 죽었다.
> 이제 남은 건 **"이 커널이 운영 환경에서도 0건 사고로 돌아가는가"** 를 증명하는 일,
> 그리고 그 위에 **돈 버는 엔진을 한 단 더 얹는 일**이다.
>
> 트럼프급 자신감 + 머스크급 추진력으로 갈 다음 5개 페이즈.

---

## PHASE 2 — OBSERVABILITY KERNEL (이번 주)
**"보이지 않으면 고칠 수 없다"**

커널은 닫혔지만 운영 시야가 비었다. v3.2가 만들어낸 `live_position_intents`, `live_position_open_audit`, `lease_until` 데이터를 **사람이 읽는 화면**으로 끌어올린다.

- `/admin/kernel` 신규 탭 (AAL2 보호)
  - **In-flight intents 라이브 패널**: `reserved` 상태 + `lease_until` 카운트다운, 주황/적색 임계
  - **Lease leak 감지**: 만료 후 N분 reserved → 자동 anomaly_event + 알림
  - **Audit trail 검색**: crid / user_id / outcome / error_code 필터
  - **Drift 그래프**: `price_moved_resync` / `oracle_stale` / `duplicate_in_flight` 시간별 발생률
- `reclaim_stale_intents()` cron (`*/1 * * * *`) — 만료된 reserved 강제 정리 + 보고
- p50/p95/p99 latency를 `live_open_position` 별로 수집 (`spans` 활용)

**완료 기준**: 운영자가 화면 하나로 "지금 위험한가/정상인가" 5초 안에 판단 가능.

---

## PHASE 3 — ORACLE FORTRESS (다음 주)
**"단일 오라클 = 단일 장애점. 죽인다."**

현재 `oracle_prices`는 단일 소스 + 5초 freshness gate. v3.2 커널이 신뢰하는 유일한 입력값인데, 여기가 무너지면 커널 전체가 무용지물.

- **다중 오라클 합의**: Bybit + Binance + Coinbase 3중화
  - `oracle_prices_raw` (소스별) → `oracle_prices`(median 합의)
  - 2/3 합의 실패 시 `oracle_quorum_lost` raise
- **이상치 자동 격리**: median 대비 ±0.3% 벗어난 소스는 weight 0
- **Oracle health dashboard**: 소스별 lag/staleness/divergence
- **Failover drill**: 카오스 스크립트로 Bybit kill → Binance/Coinbase로 자동 절체 검증

**완료 기준**: 단일 거래소가 30초간 다운돼도 커널은 무중단.

---

## PHASE 4 — CHAOS & DR DRILL (2주차)
**"머스크는 로켓을 일부러 폭파시킨다. 우리도 그래야 한다."**

- **Chaos suite 확장** (`scripts/chaos/`):
  - kernel-chaos: live_open_position에 의도적 timeout/abort 주입
  - oracle-chaos: oracle_prices 강제 backdate
  - lease-chaos: reserved 상태에서 client crash 시뮬
  - 결과: anomaly_events에 chaos 태그로 적재 → 자동 리포트
- **PITR 복구 드릴**: 30분 전 시점으로 복구 → 정합성 체크리스트 (잔액/포지션/PHON)
- **Runbook 갱신**: `docs/operations/admin-recovery-runbook.md` v2
- **카나리 트래픽**: 신규 마이그레이션은 1% 사용자만 노출하는 feature flag 패턴

**완료 기준**: 분기 1회 풀 카오스 드릴 자동 실행, 리포트가 Slack/메일로 발송.

---

## PHASE 5 — REVENUE FLYWHEEL v2 (3~4주차)
**"커널이 안전해졌다 = 더 공격적인 수익 엔진을 돌릴 수 있다."**

지금까지 안정성에 투자했으니 이제 페달을 밟는다.

- **Whale Strike Funnel 최적화**: 현재 24h CTR 측정 중 → A/B 3개 카피 자동 회전 + 승자 자동 채택
- **Empire Booster 트리거 확장**: Baron 외 Lord(5)·Duke(6) 승급에도 짧은(2~6h) 부스터 발급 → 중간 티어 정체 해소
- **NFT × Leverage 곱셈 시각화**: Bet 패널에 "당신의 max leverage = base × (1+boost)" 실시간 계산기
- **First Emperor Burst 캠페인**: 첫 입금 후 60초 내 베팅까지 가는 전환을 funnel-event로 추적, 이탈 지점 마이크로 카피 개선
- **Revenue 어트리뷰션 v2**: viral_rail 클릭 → 입금 → 베팅 → PnL까지 단일 user journey row

**완료 기준**: 30일 이동 ARPU +25%, whale_rail CTR→deposit 전환율 +40%.

---

## PHASE U — UNICORN INFRA (병행, 백그라운드)
`phonara-unicorn/` 스캐폴드는 있지만 실배포 미완. ECR 이미지 / 도메인 / secrets 채우고 Terraform apply → API/worker-render/worker-upload 3대 라이브. 트래픽이 Supabase edge function 한계를 넘기 전에 끝내야 한다.

---

# 📊 우선순위 매트릭스

```text
            영향 ↑
              │  [Phase 5: Revenue]      [Phase 3: Oracle Fortress]
              │     수익 직결                커널 신뢰 기반
              │
              │  [Phase 2: Observability] [Phase 4: Chaos/DR]
              │     운영 시야                장애 면역
              │
              └────────────────────────────→ 긴급 ↑
```

추천 실행 순서: **Phase 2 → 3 → 4 → 5** (Phase U는 4주차 합류).

---

# 🎯 다음 한 수 — 추천

지금 당장 시작할 한 가지를 고르라면 **Phase 2: Observability Kernel**.
이유:
1. v3.2가 만들어낸 데이터를 즉시 자산화
2. Phase 3/4의 측정 기반이 됨 (이게 없으면 Oracle/Chaos 효과 측정 불가)
3. 1~2일이면 첫 화면이 뜬다 — 빠른 승리

**시작 명령어 한 줄**: "Phase 2 GO" 라고만 답하시면 `/admin/kernel` 탭부터 만듭니다.

또는 다른 페이즈를 먼저 가고 싶으시면 번호만 말씀해 주세요.

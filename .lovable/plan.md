# ApexForge Phase 2 — 최종 마무리

## 목표
Plinko RTP 정규화는 마이그레이션으로 완료됨. 남은 1건만 처리하여 Phase 2를 100% 종료한다.

## 작업
1. `docs/apex/house-edge.md` 생성
   - 게임별 RTP / House Edge 요약표 (Dice/Crash/Plinko/Mines = 99.0%, Slots = 97.0%, Sportsbook vig 4.5%)
   - 게임별 수식 (Dice·Crash·Plinko·Mines·Slots·Sportsbook)
   - Monte-Carlo 시뮬레이션 결과 (100k spins per game)
   - Stake.com 비교표
   - 운영 가드레일 (일일 캡, 음수잔액 차단, 머니플로 격리, provably-fair)

## 검증
- 머니플로 freeze: 8/8 경로 git diff = 0 (DB 마이그레이션 + docs 추가만이라 영향 없음)
- 번들 사이즈: 변경 없음 (문서 파일만 추가)
- RTP: Slots 97.0%, Plinko 99.0%, 나머지 99.0%

## 최종 보고
완료 시 Phase 2 최종 완료 보고를 사용자가 지정한 포맷으로 출력.

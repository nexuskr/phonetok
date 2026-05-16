# Sprint 0 — Week 2: Great Simplification 완성

목표: TopBar 분리 + 디자인 토큰 정리 + 랜딩 리뉴얼 + 60초 온보딩 + 전역 일관성 QA.
v14.0 마스터 플랜의 "5초 North Star" 기준에 도달.

## 1. PhonaraTopBar 분리

`src/components/nav/PhonaraTopBar.tsx` 신규 생성.

- 좌: PHONARA.WORLD 로고 (`/` 이동)
- 중앙(데스크탑) / 우(모바일): PHON 잔액 칩 + "충전" 버튼 (→ `/wallet`)
- 우: 알림 벨 + 프로필 아바타 드롭다운(내정보 / VIP / 설정 / 로그아웃)
- Sticky top, 다크 + 골드/핫핑크 액센트, 1px gradient border-bottom
- 미인증 시: "로그인" / "무료로 시작" CTA만 표시

`PhonaraNav`(4탭)과 결합해 `<Layout>`에서 자동 마운트되도록 정리.

## 2. 디자인 토큰 체계화

`src/index.css`의 `:root` / `.dark`에 v14.0 토큰 통합 적용:

```text
--bg: 222 47% 7%
--card: 222 40% 10%
--gold: 44 88% 58%
--pink: 340 100% 62%
--text: 0 0% 96%
--muted: 222 15% 60%
--border-gradient: linear-gradient(135deg, hsl(var(--gold)/.4), hsl(var(--pink)/.4))
--shadow-premium: 0 10px 40px -10px hsl(var(--gold)/.25)
```

- `tailwind.config.ts`에 `gold`, `pink`, `bg`, `text`, `muted` 시맨틱 컬러 추가
- 기본 다크모드 강제(`<html class="dark">`), 라이트 토큰은 동일 키로 매핑(추후 옵션)
- 폰트: Pretendard(본문) + Space Grotesk(디스플레이) `index.css`에서 `@import`
- 기존 페이지에서 직접 색상(`text-white`, `bg-black` 등) 사용 시 시맨틱 토큰으로 치환

## 3. 신규 랜딩 `/` 리뉴얼

`src/pages/Landing.tsx` 신규 + `src/App.tsx`에서 `/`를 `<Landing />`로 교체(기존 Index는 `/legacy`로 alias 보존, 추후 제거).

구성(스크롤 5섹션, 풀스크린 cinematic):

1. Hero: "오늘도 4,800원 벌었어요" 카운터 애니메이션 + CTA `지금 무료로 시작하기 +500 PHON`
2. 4탭 프리뷰 카드(수익 / 게임 / 투자 / 실시간) — 가로 스와이프(모바일) / 그리드(데스크탑)
3. 실시간 출금 티커 (`get_recent_payouts_100` 재사용)
4. "왜 PHONARA?" 3가지 (무료로 돈 / 부업+게임 / 헤어날 수 없는 재미)
5. 최종 CTA 밴드

framer-motion으로 hero 1회 진입 모션, 카드 hover lift.

## 4. 60초 온보딩

`src/components/onboarding/OnboardingV3.tsx` 신규(기존 `OnboardingV2` 대체, dashboard 마운트 위치 교체).

스텝(5단계, 평균 12초씩):
1. 환영 + +500 PHON 즉시 지급 표시
2. 무료 룰렛 1회 데모(실제 RPC 호출 X, 클라 애니메이션)
3. 오늘의 첫 미션(출석 체크 — 실제 `claim_attendance` 연동)
4. 게임 1개 미리보기(슬롯 데모 1스핀 free-play)
5. "충전하면 2배" CTA + "나중에" 옵션

localStorage `phonara:onboarding_v3_done`로 1회 표시.

## 5. 전역 일관성 QA

- `/home`, `/earn`, `/games`, `/trade`, `/live`, `/wallet`에서 PhonaraTopBar + PhonaraNav 정상 표시 확인
- 카드 간격 24px+, 모션 0.2~0.3s, 모바일 safe-area 대응
- glossary 적용 누락 페이지 sweep (Empire/Crown/Whale 잔존 문구)
- 빈상태/로딩 = `EmptyState`/`LoadingList`, 토스트 = `notify` 강제

## 기술 메모

- 회귀 0: 기존 라우트/RPC/기능 변경 없음, 시각/네비/랜딩만 교체
- 디자인 토큰은 HSL만 사용, 컴포넌트 직색상 금지(Core memory 준수)
- PWA: 기존 manifest 유지, hero 이미지 lazy + AVIF/WebP 우선
- 접근성: TopBar 키보드 포커스링(gold), aria-label 한글
- 성능: Landing은 above-the-fold 클라 컴포넌트만, 나머지는 dynamic import

## 산출물

- 신규: `PhonaraTopBar.tsx`, `Landing.tsx`, `OnboardingV3.tsx`
- 수정: `index.css`, `tailwind.config.ts`, `App.tsx`, `Layout`(TopBar 마운트), Dashboard(OnboardingV2→V3 교체)
- 검증: `/` 5초 룰 통과, 4탭 네비 일관, 다크 토큰 100% 적용

# No-JS Fallback — Warm King MAX

## 현재 상태
`index.html` line 96–98 의 `<noscript>` 는 한 줄짜리:
> "Phonara를 사용하려면 JavaScript를 활성화해주세요."

JS 비활성 사용자, AI 크롤러(Grok/Perplexity/ChatGPT 검색), 일부 SEO 봇이
플랫폼 가치를 전혀 알 수 없는 상태.

## 변경

`index.html` 한 파일만 수정. `<noscript>` 블록을 풀-렌더링된 정적 랜딩으로 교체.

### 들어갈 섹션 (위→아래)

1. **Hero** — "0원으로 시작 · 한국인을 사기로부터 지키는 단 하나의 사이트"
   - Gold(#f4d77a) + Hot Pink(#ff3d8a) + Deep Space Black(#08070f)
   - 큰 글씨(48–72px), 고대비 (WCAG AAA)
2. **3-Pillar 그리드** — Empire / Founding Seat / Live Whale Strike
   - 정적 텍스트로 핵심 가치 제안
3. **Trust strip** — 출금 보장 · 손실 보호 · 24h 모니터링
4. **CTA 2개** — `/auth` (무료 시작) · `/trust` (실시간 출금 보기)
5. **AI Crawler hint** — 작은 회색 텍스트로 "Phonara is a real-time AI
   decision intelligence platform for Korean users…" (Grok/Perplexity 친화)

### 스타일 규칙
- 모든 CSS 인라인 (외부 시트 의존 X — JS 없을 때 안전)
- 시스템 폰트 + Pretendard 폴백 (이미 head 에 link 됨, JS 불요)
- `<noscript>` 내부는 브라우저에 의해 JS 활성 시 완전 무시됨 → 번들/렌더 0 영향
- Degrade Mode 와 무관 (Degrade Mode 는 JS 런타임 기능)
- 모바일 우선: max-width 720px 컨테이너 + flex 컬럼

### SEO 강화 (head 일부 수정)
- `<meta name="description">` 을 더 구체적으로 (현재 "복잡한 설명은…" → AI 키워드 포함)
- `<meta name="keywords">` 에 "Founding Seat, Whale Strike, Crown, Empire Booster, 0원 시작" 추가
- WebApplication JSON-LD 에 `description` + `featureList` 추가 (Grok 인덱싱)

## 절대 불변
- `index.html` **단일 파일** 만 수정
- money-flow 8경로 git diff = 0 (touch 없음)
- @pkg / Operator Isolation / Bundle Budget / Realtime — 무관 (HTML only)
- Helmet per-route head 동작 그대로 (canonical 제거 상태 유지)
- og:image / theme-color / manifest — 그대로

## 검증
- `cat index.html | grep -c '<noscript>'` = 1
- 정적 파일이므로 빌드 영향 없음 (Vite 가 그대로 통과)
- Lighthouse / 크롤러 시뮬레이션은 빌드 후 user 측에서 확인

## 영향
- 빌드 시간 / 번들 크기: **0 변화**
- 런타임 JS 동작: **0 변화** (JS 활성 시 `<noscript>` 무시)
- AI 크롤러 컨텍스트: **+~1.5KB 의미있는 의미론적 HTML**

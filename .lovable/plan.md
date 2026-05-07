## 랜딩페이지 리브랜딩 — PHONEMISSION → PHONARA Empire

현재 `/` 랜딩페이지는 구버전 "PHONEMISSION" 사이버펑크 느낌(보라+청록 그라데이션, 폰 이모지 로고)이라 로그인 후 보이는 PHONARA 임페리얼 골드 컨셉과 단절됩니다. 통일된 브랜드 경험으로 재구성합니다.

### 1. 브랜드 헤더 교체
- 폰 이모지 로고 → 골드 크라운 아이콘 + `PHONARA` 워드마크
- "PHONE/MISSION" 분리 → 단일 `text-gradient-imperial` 타이틀
- 네비 CTA: "지금 시작" → "Empire 입성"

### 2. Hero 카피 전면 교체
- 배지: "2026 한국 No.1 사이버 수익 플랫폼" → "PHONARA EMPIRE · 2026 GLOBAL"
- H1: "폰 하나로 시작하는 진짜 사이버 수익" → **"왕좌는 클릭 한 번으로 시작된다"** / 영문 보조 "Your Empire Begins Here"
- 서브카피: AI 미션 → **임페리얼 미션 / 골드 정산 / 창립 멤버 30석** 강조
- 색상: `text-gradient-cyber`(보라+청록) → `text-gradient-imperial`(골드)

### 3. 실시간 정산 카드
- 누적 정산 카드 → **Throne Balance 카드** (command-throne-bg.jpg 활용, 골드 글로우)
- "₩" 심볼은 유지하되 폰트를 Orbitron + 골드 그라데이션
- 하단: "현재 N명 접속중" → **EmpireFoundingCounter 통합** (30석 카운터)

### 4. CTA 골드화
- 메인 버튼 `bg-gradient-primary` → `bg-gradient-imperial` + `glow-imperial`
- "시작하고 보상받기" → **"창립 멤버로 입성"**
- FREE 배지: "FREE 플랜 평생 무료" → "창립 멤버 한정 · 평생 골드 등급"

### 5. 트러스트 배지 / Feature 섹션
- 3-카드(암호화/인증/즉시정산): 아이콘 색상을 골드로, 카피는 유지
- Feature 3-카드: "AI 자동 미션" → **"임페리얼 미션"**, "VIP 패키지" → **"5-Tier Empire"**, "글로벌 라이브 정산" → **"Throne Treasury"**

### 6. EMPIRE COUNCIL 섹션 정리
- "선착순 20명" → **30석으로 통일** (DB와 일치)
- "Phantom 카운슬" 후기 카드 → **"Imperial Council"** 으로 명칭 정리
- 후기 6명의 등급 라벨도 PHONARA 5-Tier(Bronze/Silver/Gold/Platinum/Imperial)로 교체

### 7. Stats / 최종 CTA
- "활성 회원/누적 정산/성공률/만족도" 유지하되 색상 `text-gradient-aurora` → `text-gradient-imperial`
- 최종 CTA: "지금이 가장 빠른 시작입니다" → **"왕좌가 당신을 기다립니다"**
- Footer: 이미 `© 2026 Phonara` 로 되어있음 ✓

### 8. 다국어 (i18n)
- 새 카피 모두 `src/lib/i18n.ts` `landing.*` 네임스페이스에 ko/en/ja/zh 4개 언어로 등록
- 기존 LanguageSwitcher가 우상단에서 동작

### 9. 비주얼 디테일
- 배경 보라/청록 blur orb → 골드/임페리얼 톤으로 교체
- Particles density 70 유지, 색상은 이미 primary 사용 중이라 자동 골드화
- Hero 우측에 `login-crown-phone.png` 살짝 띄우는 옵션(데스크톱만, opacity 0.3 float)

### 기술 메모
- 단일 파일 수정: `src/pages/Index.tsx`
- 신규 i18n 키 추가: `src/lib/i18n.ts`
- 이미 존재하는 토큰 재사용: `text-gradient-imperial`, `bg-gradient-imperial`, `glow-imperial`, `command-throne-bg.jpg`, `EmpireFoundingCounter`
- 백엔드/로직 변경 없음 — 순수 프레젠테이션 레이어

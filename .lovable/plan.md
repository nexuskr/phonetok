# Phase 5 백엔드 복구 — 경로 C (+ 경로 A 안전망)

대상: 독립 백엔드 `wyhhdyrvqtoejvusnhva` (phonara-world-main)
금지: 관리형 `ketlqzfaplppmupaiwft` 에는 어떤 SQL/함수도 적용 금지

## 현실 체크 (중요)

`scripts/independence/0[1-3]-*.sh` 는 **로컬 머신에서만** 실행 가능합니다.
이유:
- `supabase login` — 브라우저 OAuth 필요
- `supabase link --project-ref wyhhdyrvqtoejvusnhva` — 사용자 자격증명 필요
- `supabase db dump` — Docker 데몬 필요
- `supabase db push` — 독립 ref 에 직접 쓰기 (Lovable 마이그레이션 툴은 관리형 ref 에만 적용됨)

따라서 **에이전트가 푸시를 대행할 수 없습니다.** 대신 두 트랙을 동시에 준비합니다:

- **트랙 1 (경로 C, 권장):** 사용자가 로컬에서 3-스크립트 시퀀스 실행 → 에이전트가 검증 SQL 과 후속 단계를 가이드
- **트랙 2 (경로 A, 안전망):** 02 diff 결과가 sync 라면 핵심만 담은 `phase5-recovery.sql` 단일 파일 제공 → SQL Editor 또는 psql 로 1회 실행

## 트랙 1 — 사용자 실행 순서

```text
[사용자 로컬]                                   [독립 백엔드 wyhhdyrvqtoejvusnhva]
  01-prepare.sh    ──login + link──────────►        (인증)
  02-pull-and-diff ──db dump──────────────►   _remote_baseline.sql 생성
                   └─diff 산출──────────►   supabase/migrations/_DIFF_REPORT.txt
  [diff 검토]
  03-deploy.sh     ──db push──────────────►   누락 migration 적용
                   └─functions deploy 44개►   엣지 배포
```

사용자 명령:
```bash
cd <repo>
export TARGET_REF=wyhhdyrvqtoejvusnhva
bash scripts/independence/01-prepare.sh
bash scripts/independence/02-pull-and-diff.sh
# → supabase/migrations/_DIFF_REPORT.txt 검토 후
bash scripts/independence/03-deploy.sh
```

푸시 후 사용자가 채팅에 “03 완료” 라고만 알려주면 에이전트가 검증 SQL 4묶음을 SQL Editor 용으로 즉시 전달합니다. (RPC 존재/EXECUTE, profiles RLS, trigger 연결, 신규 가입 시뮬레이션)

## 트랙 2 — 경로 A 안전망 (`phase5-recovery.sql`)

02 의 `_DIFF_REPORT.txt` 가 비어 있다면(이미 sync), 푸시할 게 없다는 뜻이므로 누락된 항목만 정정하는 **idempotent 단일 파일** 을 제공합니다. 핵심 구성:

1. 5개 RPC `CREATE OR REPLACE FUNCTION` (기존 정의 그대로 재선언, SECURITY DEFINER + `set search_path = public`)
2. `REVOKE ALL FROM public` + `GRANT EXECUTE TO authenticated` (5개)
3. `profiles` 자가 RLS 3개 (`drop policy if exists` 후 재생성)
4. `handle_new_user()` + `on_auth_user_created` 트리거 재생성
5. `wallet_balances`, `user_roles` 자동 시드 INSERT … ON CONFLICT DO NOTHING

실행 위치: 독립 백엔드 SQL Editor (대시보드) 또는 `psql "$DATABASE_URL_WYH" -f phase5-recovery.sql`. 절대 Lovable 마이그레이션 툴 사용 금지(관리형 ref 로 들어감).

## 검증 SQL (트랙 1·2 공통, 푸시 후 실행)

```sql
-- (1) 5개 RPC 존재 + EXECUTE 권한
select p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('register_device','assign_persona','record_span',
                    'get_active_boost_count','get_empire_seats_remaining');

-- (2) profiles RLS 정책
select policyname, cmd from pg_policies
where schemaname='public' and tablename='profiles';

-- (3) 가입 트리거 연결
select tgname, tgrelid::regclass, tgenabled
from pg_trigger where tgname='on_auth_user_created';

-- (4) 가입 시뮬레이션 (Auth → Add user 로 1명 생성 후)
select (select count(*) from public.profiles        where id=:uid) as profile_ok,
       (select count(*) from public.wallet_balances where user_id=:uid) as wallet_ok,
       (select count(*) from public.user_roles      where user_id=:uid) as role_ok;
```

## Vercel 단계 (3·4번)

스크립트 완료 후 에이전트가 가이드:
1. Vercel → Project → Settings → Environment Variables
   - `VITE_SUPABASE_URL` = `https://wyhhdyrvqtoejvusnhva.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (독립 ref anon key)
   - `VITE_SUPABASE_PROJECT_ID` = `wyhhdyrvqtoejvusnhva`
   - 3개 모두 Production / Preview / Development 체크
2. Deployments → 최신 → ⋯ → Redeploy → **“Use existing Build Cache” 해제**
3. 검증: `curl -I https://phonara.net/complete-profile` → 200, 빌드 JS 에 `wyhhdyrvqtoejvusnhva` 문자열 grep 으로 존재 확인

## Rollback

- 트랙 1: 03 푸시는 마이그레이션 단위라 실패 파일만 재시도. functions deploy 실패는 개별 재배포.
- 트랙 2: `phase5-recovery.sql` 은 idempotent 라 재실행 안전. 잘못 적용 시 `DROP FUNCTION public.<name> CASCADE` 후 원래 마이그레이션에서 재선언.
- Vercel: 직전 deployment 의 “Promote to Production” 으로 즉시 롤백.

## 승인 시 에이전트가 할 일

1. 사용자가 로컬 명령을 돌리는 동안 대기 (또는 02 diff sync 보고 시 트랙 2 로 전환)
2. 트랙 2 전환 시 `scripts/independence/phase5-recovery.sql` 작성 (실제 컬럼·시그니처는 기존 마이그레이션에서 복사)
3. 사용자가 “03 완료” 또는 “SQL 적용 완료” 라고 알리면 검증 SQL 4묶음 전달
4. 검증 PASS 후 Vercel 환경변수·Redeploy 가이드 및 `curl` 점검 보조

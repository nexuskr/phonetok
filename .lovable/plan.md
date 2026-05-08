## PR3 v6 — One-Shot Forensic Migration Bundle

단일 atomic migration + edge patch + CI 갱신. 부분 실행 금지.

---

### STEP 1 — `viral_verification_log` 이중 권위 제거 (Fix 1)

```sql
-- legacy dual authority 제거
ALTER TABLE viral_verification_log
  DROP CONSTRAINT IF EXISTS signals_initial_locked_chk;
ALTER TABLE viral_verification_log
  DROP COLUMN IF EXISTS signals_initial_locked;

-- shape guard (INSERT only)
CREATE OR REPLACE FUNCTION guard_signals_initial_shape()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  allowed_keys text[] := ARRAY['rules_fired','risk_score','model_version','decided_at'];
  k text;
BEGIN
  IF NEW.signals_initial IS NULL OR jsonb_typeof(NEW.signals_initial) <> 'object' THEN
    RAISE EXCEPTION 'signals_initial must be jsonb object';
  END IF;
  FOR k IN SELECT jsonb_object_keys(NEW.signals_initial) LOOP
    IF NOT (k = ANY(allowed_keys)) THEN
      RAISE EXCEPTION 'invalid key in signals_initial: %', k;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

-- absolute immutability (UPDATE/DELETE 차단)
CREATE OR REPLACE FUNCTION guard_verification_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'viral_verification_log is write-once immutable';
END $$;

DROP TRIGGER IF EXISTS trg_vvl_immutable ON viral_verification_log;
CREATE TRIGGER trg_vvl_immutable
  BEFORE UPDATE OR DELETE ON viral_verification_log
  FOR EACH ROW EXECUTE FUNCTION guard_verification_log_immutable();

DROP TRIGGER IF EXISTS trg_vvl_signals_initial ON viral_verification_log;
CREATE TRIGGER trg_vvl_signals_initial
  BEFORE INSERT ON viral_verification_log
  FOR EACH ROW EXECUTE FUNCTION guard_signals_initial_shape();
```

---

### STEP 2 — AI Circuit 직렬화 상태 머신 (Fix 2)

```sql
CREATE TABLE IF NOT EXISTS viral_ai_circuit_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  state text NOT NULL DEFAULT 'closed'
    CHECK (state IN ('closed','open','half_open')),
  opened_at timestamptz,
  last_evaluated_at timestamptz DEFAULT now(),
  reason text
);
INSERT INTO viral_ai_circuit_state (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE viral_ai_circuit_state ENABLE ROW LEVEL SECURITY;

-- 유일한 write 진입점 (advisory lock + FOR UPDATE + 유효 전이 그래프)
CREATE OR REPLACE FUNCTION transition_ai_circuit(
  _new_state text, _reason text, _meta jsonb DEFAULT '{}'::jsonb
) RETURNS viral_ai_circuit_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec viral_ai_circuit_state;
BEGIN
  PERFORM set_config('app.circuit_rpc','on', true);
  PERFORM pg_advisory_xact_lock(8821736401);

  SELECT * INTO rec FROM viral_ai_circuit_state WHERE id = 1 FOR UPDATE;

  IF NOT (
    (rec.state = 'closed'    AND _new_state = 'open')
 OR (rec.state = 'open'      AND _new_state = 'half_open')
 OR (rec.state = 'half_open' AND _new_state IN ('closed','open'))
 OR (rec.state = _new_state)
  ) THEN
    RAISE EXCEPTION 'invalid circuit transition % -> %', rec.state, _new_state;
  END IF;

  UPDATE viral_ai_circuit_state
     SET state = _new_state,
         opened_at = CASE WHEN _new_state='open' THEN now() ELSE opened_at END,
         last_evaluated_at = now(),
         reason = _reason
   WHERE id = 1
   RETURNING * INTO rec;

  INSERT INTO viral_verification_events (submission_id, event_type, signals_raw)
  VALUES (NULL, 'ai_circuit_transition',
          jsonb_build_object('to', _new_state, 'reason', _reason, 'meta', _meta));
  RETURN rec;
END $$;

REVOKE ALL ON FUNCTION transition_ai_circuit(text,text,jsonb) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION transition_ai_circuit(text,text,jsonb) TO service_role;

-- 직접 write 차단 (RPC 진입 시 session var로 우회)
CREATE OR REPLACE FUNCTION guard_no_direct_circuit_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.circuit_rpc', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'direct circuit mutation forbidden — use transition_ai_circuit()';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_circuit_block ON viral_ai_circuit_state;
CREATE TRIGGER trg_circuit_block
  BEFORE INSERT OR UPDATE OR DELETE ON viral_ai_circuit_state
  FOR EACH ROW EXECUTE FUNCTION guard_no_direct_circuit_write();
```

---

### STEP 3 — Audit dual-write (Fix 3, Phase A+B+C)

```sql
-- v2 partitioned canonical
CREATE TABLE viral_settlement_audit_v2 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  event_type text NOT NULL,
  actor text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE viral_settlement_audit_v2_2026_05
  PARTITION OF viral_settlement_audit_v2
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE viral_settlement_audit_v2_2026_06
  PARTITION OF viral_settlement_audit_v2
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

ALTER TABLE viral_settlement_audit_v2 ENABLE ROW LEVEL SECURITY;

-- 미래 파티션 자동 보장
CREATE OR REPLACE FUNCTION ensure_settlement_audit_partition(_when timestamptz DEFAULT now())
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  start_d date := date_trunc('month', _when)::date;
  end_d   date := (date_trunc('month', _when) + interval '1 month')::date;
  pname text := format('viral_settlement_audit_v2_%s', to_char(start_d,'YYYY_MM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF viral_settlement_audit_v2 FOR VALUES FROM (%L) TO (%L)',
    pname, start_d, end_d);
END $$;

-- dual-write trigger
CREATE OR REPLACE FUNCTION audit_dualwrite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO viral_settlement_audit_v2
    (id, submission_id, event_type, actor, details, created_at)
  VALUES
    (NEW.id, NEW.submission_id, NEW.event_type, NEW.actor, NEW.details, NEW.created_at)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_dualwrite ON viral_settlement_audit;
CREATE TRIGGER trg_audit_dualwrite
  AFTER INSERT ON viral_settlement_audit
  FOR EACH ROW EXECUTE FUNCTION audit_dualwrite();

-- backfill (idempotent)
INSERT INTO viral_settlement_audit_v2 (id, submission_id, event_type, actor, details, created_at)
SELECT id, submission_id, event_type, actor, details, created_at
FROM viral_settlement_audit
ON CONFLICT DO NOTHING;

-- diff assertion
CREATE OR REPLACE FUNCTION assert_audit_sync()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE diff int;
BEGIN
  SELECT abs(
    (SELECT count(*) FROM viral_settlement_audit) -
    (SELECT count(*) FROM viral_settlement_audit_v2)
  ) INTO diff;
  IF diff <> 0 THEN
    RAISE EXCEPTION 'audit mismatch (diff=%)', diff;
  END IF;
END $$;
```

> **Note**: cutover (legacy → v2 rename)는 별도 운영 윈도우에서 `LOCK TABLE ACCESS EXCLUSIVE` + `assert_audit_sync()` + RENAME 으로 수행. 본 번들에는 cutover 자동화는 포함하지 않는다 (수동 컨트롤 유지).

---

### STEP 4 — `verify-submission` edge function 패치

```ts
// supabase/functions/verify-submission/index.ts (요점)
const { data: circuit } = await admin
  .from('viral_ai_circuit_state').select('*').eq('id', 1).single();

// 1. RULE FIRST — 항상 deterministic
const { data: rule } = await admin.rpc('rule_verify_submission', { p_submission_id: submissionId });

// 2. AI OPTIONAL — circuit open이면 skip
let ai_outcome: 'observed' | 'fallback_rule_only' | 'circuit_open' | 'skipped' = 'skipped';
if (circuit.state === 'open') {
  ai_outcome = 'circuit_open';
} else {
  try {
    const ai = await callBoundedAI(payload); // strict enum + range guard
    if (ai.drift) {
      await admin.from('viral_verification_events').insert({
        submission_id: submissionId, event_type: 'ai_drift_alert',
        signals_raw: { reason: ai.driftReason }
      });
      ai_outcome = 'fallback_rule_only';
    } else {
      await admin.from('viral_verification_events').insert({
        submission_id: submissionId, event_type: 'ai_signal',
        signals_raw: ai.raw
      });
      ai_outcome = 'observed';
    }
  } catch (e) {
    await admin.from('viral_verification_events').insert({
      submission_id: submissionId, event_type: 'ai_error',
      signals_raw: { message: String(e).slice(0, 500) }
    });
    ai_outcome = 'fallback_rule_only';
  }
}

// verdict는 100% rule
return new Response(JSON.stringify({
  verdict: rule.status,        // VALID | INVALID | SUSPECT
  ai_outcome,
}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```

`evaluate-ai-circuit` 와 half_open trial 경로는 모두 `admin.rpc('transition_ai_circuit', ...)` 호출만 사용. 직접 UPDATE 금지.

---

### STEP 5 — CI 차단 룰 추가 (`scripts/check-pr3-isolation.mjs`)

차단 패턴:
- `UPDATE\s+viral_verification_log` / `DELETE\s+FROM\s+viral_verification_log`
- migration/edge에서 `viral_ai_circuit_state` 직접 `INSERT|UPDATE|DELETE` (단, `transition_ai_circuit` 정의부 예외)
- `verify-submission` 내 `viral_mission_catalog` SELECT
- AI prompt 문자열에 `reward|value|credit|ltv|revenue|payout|amount` 토큰 등장
- `signals_initial_locked` 컬럼 재도입
- `viral_verification_context_v` 의 `CREATE VIEW` SQL에 JOIN 포함

GitHub Action: PR마다 SQL/TS AST 파싱 후 위반 시 fail.

---

### 최종 시스템 상태

| Layer | 상태 |
|---|---|
| `viral_verification_log` | write-once ledger (trigger-only authority) |
| `viral_verification_events` | append-only raw telemetry |
| AI circuit | serialized FSM, 단일 RPC 진입점 |
| `viral_settlement_log` | idempotency PK |
| `viral_settlement_audit` → v2 | dual-write + 월별 파티션 |
| verdict | 100% deterministic rule |
| AI | observation only, circuit-bounded |

### Out of scope (재확인)
보상 재계산 / LTV·ARPU / RRM 정책 / user-facing risk_score / AI verdict 권한 / PR2 reward logic / cutover 자동화 / 콜드 스토리지 export.

### 적용 순서
1. STEP 1~3 단일 migration 번들로 실행 (atomic)
2. STEP 4 edge function 배포 (자동)
3. STEP 5 CI 룰 머지
4. 운영 윈도우에서 audit cutover 수동 수행

### 한 줄 정의
> **mutationless, AI-bounded, circuit-controlled forensic substrate — verification은 deterministic, AI는 observational, settlement는 strictly idempotent.**

승인하면 STEP 1~3 단일 migration부터 실행한다.
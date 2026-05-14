
ALTER TABLE public.phon_transactions DROP CONSTRAINT IF EXISTS phon_transactions_kind_check;
ALTER TABLE public.phon_transactions ADD CONSTRAINT phon_transactions_kind_check
  CHECK (kind = ANY (ARRAY['deposit_usdt','first_deposit_godmode','war_prize','referral','admin_adjust','spend','buyback','bequest_in','bequest_out','fee_discount','booster_purchase','crown_boost_purchase']));

ALTER TABLE public.nft_collection
  ADD COLUMN IF NOT EXISTS bequeathed_from uuid,
  ADD COLUMN IF NOT EXISTS external_chain text,
  ADD COLUMN IF NOT EXISTS external_token_id text,
  ADD COLUMN IF NOT EXISTS locked_for_migration boolean NOT NULL DEFAULT false;

ALTER TABLE public.nft_collection DROP CONSTRAINT IF EXISTS nft_collection_source_check;
ALTER TABLE public.nft_collection ADD CONSTRAINT nft_collection_source_check
  CHECK (source = ANY (ARRAY['deposit','baron','founding','admin','bequest']));

ALTER TABLE public.phon_balances
  ADD COLUMN IF NOT EXISTS snapshot_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_balance numeric;

CREATE TABLE IF NOT EXISTS public.dynasty_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  child_id uuid,
  child_email text NOT NULL,
  invite_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dynasty_links_parent ON public.dynasty_links(parent_id, status);
CREATE INDEX IF NOT EXISTS idx_dynasty_links_child ON public.dynasty_links(child_id, status) WHERE child_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dynasty_links_active_pair ON public.dynasty_links(parent_id, child_id) WHERE status = 'active' AND child_id IS NOT NULL;

ALTER TABLE public.dynasty_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dynasty_self_select ON public.dynasty_links;
CREATE POLICY dynasty_self_select ON public.dynasty_links FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR child_id = auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS dynasty_admin_all ON public.dynasty_links;
CREATE POLICY dynasty_admin_all ON public.dynasty_links FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.bequest_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.dynasty_links(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL,
  child_id uuid NOT NULL,
  asset_kind text NOT NULL CHECK (asset_kind IN ('phon','nft')),
  phon_amount numeric,
  nft_id uuid REFERENCES public.nft_collection(id),
  status text NOT NULL DEFAULT 'cooldown' CHECK (status IN ('cooldown','executable','executed','cancelled','expired')),
  cooldown_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  cancelled_at timestamptz,
  notes text
);
CREATE INDEX IF NOT EXISTS idx_bequest_parent ON public.bequest_requests(parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bequest_child ON public.bequest_requests(child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bequest_status ON public.bequest_requests(status, cooldown_until);

ALTER TABLE public.bequest_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bequest_self_select ON public.bequest_requests;
CREATE POLICY bequest_self_select ON public.bequest_requests FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR child_id = auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS bequest_admin_all ON public.bequest_requests;
CREATE POLICY bequest_admin_all ON public.bequest_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.legal_documents (doc_key, version, locale, title, body_md, is_current)
VALUES (
  'phon_nft_disclaimer', 'v1', 'ko',
  'PHON 포인트 · NFT 컬렉션 면책 고지',
$$# PHON 포인트 · NFT 컬렉션 면책 고지

## 1. PHON 포인트
PHON은 Phonara 플랫폼 내부에서만 사용되는 **유틸리티 포인트**입니다.
- **가상자산이 아닙니다.** 외부 거래소 상장·송금 불가.
- **현금 환금성 없음.** 출금 수수료 할인, 부스터 구매 등 플랫폼 내부 사용에만 사용 가능.
- 보유 PHON은 정식 토큰 발행 시점에 1:1 비율로 전환 보장됩니다.

## 2. NFT 컬렉션
NFT는 Phonara 플랫폼 내부 컬렉션입니다.
- **블록체인 NFT가 아닙니다.** 외부 마켓플레이스 거래 불가.
- 레버리지 부스트 효과를 부여하는 **권리 증서** 성격입니다.
- 정식 NFT 발행 마이그레이션 시 보유 컬렉션은 **1:1 동등 매핑**됩니다.

## 3. 자녀 양도 (Dynasty Bequest)
- **성인(만 19세 이상) + KYC 완료 자녀 계정에만** 양도 가능.
- 양도 요청 후 **48시간 쿨다운** 동안 취소 가능.
- TOTP 2단계 인증 필수.
- 부모 1명당 자녀 최대 3명, 활성화 후 7일 쿨다운.
- 양도된 PHON·NFT는 자녀 계정에서 동일하게 작동하며, 모든 양도 내역은 영구 감사 기록됩니다.

## 4. 책임 한계
- PHON·NFT의 사용으로 인한 손익은 사용자 본인 책임입니다.
- 본 면책 고지는 정식 토큰 발행 시점에 별도 약관으로 대체됩니다.

발효일: 2026년 5월 14일$$,
  true
)
ON CONFLICT (doc_key, version, locale) DO NOTHING;

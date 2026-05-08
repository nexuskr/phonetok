// DM Composer — generates personalized Korean DM variants for SNS outreach.
// Uses Lovable AI Gateway (google/gemini-2.5-flash-lite) with structured tool-calling.
// Always appends compliance footer ([광고] + 수신거부 안내).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Body = {
  channel: "tiktok" | "instagram" | "threads" | "naver" | "youtube" | "kakao";
  keywords?: string;       // 부업, 재테크, AI, 제국 ...
  persona?: string;        // 20대 직장인, 대학생, 자영업자 ...
  tone?: "friendly" | "formal" | "playful" | "hype";
  count?: number;          // 5~10
  referralLink?: string;
};

const CHANNEL_HINTS: Record<string, string> = {
  tiktok: "짧고 후킹한 첫 줄, 이모지 1~2개, 90초 안에 호기심 유발.",
  instagram: "비주얼/라이프스타일 톤, 줄바꿈 활용, 해시태그 없이 본문만.",
  threads: "솔직하고 대화체, 자기 경험처럼, 길이 3줄 내외.",
  naver: "정중한 한국어, 카페/블로그 댓글 톤, 신뢰감 있게.",
  youtube: "콘텐츠 제작자에게 협업 제안 톤, 짧고 명확하게.",
  kakao: "친구처럼 가볍게, 단순/직설적, 길이 2~3줄.",
};

const COMPLIANCE_FOOTER = "\n\n[광고] 수신거부: 차단/신고";

async function generate(body: Body): Promise<{ variants: string[] }> {
  const count = Math.max(3, Math.min(10, Number(body.count) || 5));
  const channelHint = CHANNEL_HINTS[body.channel] ?? "";
  const link = body.referralLink || "https://phonara.world";

  const tools = [{
    type: "function",
    function: {
      name: "create_dm_variants",
      description: "Create DM variants for cold outreach.",
      parameters: {
        type: "object",
        properties: {
          variants: {
            type: "array",
            items: { type: "string", description: "한국어 DM 본문 (60~180자, 컴플라이언스 푸터 제외)" },
            minItems: count,
            maxItems: count,
          },
        },
        required: ["variants"],
        additionalProperties: false,
      },
    },
  }];

  const sys = `너는 한국 SNS DM 카피라이터다. Phonara.world(AI 부업/리워드 플랫폼, 커피값 29,000원 시작)를 홍보하는 DM을 작성한다.

채널: ${body.channel} — ${channelHint}
타겟: ${body.persona || "한국 20~30대 부업 관심층"}
키워드: ${body.keywords || "부업, AI, 재테크"}
톤: ${body.tone || "friendly"}
링크: ${link}

규칙:
- 한국어, 60~180자 (이모지 포함)
- 첫 줄은 인사 + 후킹
- 본문에 링크(${link}) 자연스럽게 포함
- 과장 금지: "확정 수익", "원금 보장", "100% 수익" 같은 표현 절대 금지
- "예상 보상 한도", "시작" 같은 안전 표현만
- 다단계/MLM 단어 금지
- ${count}개 변형, 서로 다른 첫 문장 사용`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `${count}개 DM 변형을 만들어줘.` },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "create_dm_variants" } },
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("rate_limited");
    if (resp.status === 402) throw new Error("payment_required");
    throw new Error(`ai_gateway_${resp.status}`);
  }
  const j = await resp.json();
  const call = j.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("no_tool_call");
  const parsed = JSON.parse(call.function.arguments);
  const variants: string[] = (parsed.variants || []).map((v: string) =>
    String(v).trim() + COMPLIANCE_FOOTER
  );
  return { variants };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body?.channel) {
      return new Response(JSON.stringify({ error: "channel_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const out = await generate(body);
    return new Response(JSON.stringify({ ok: true, ...out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message ?? "unknown";
    const status = msg === "rate_limited" ? 429 : msg === "payment_required" ? 402 : 500;
    console.error("dm-composer error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

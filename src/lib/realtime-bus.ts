/**
 * realtime-bus — back-compat 진입점.
 *
 * 실제 구현은 `@/hooks/use-realtime-channel`의 `subscribeRealtime`로 이전됨.
 * 모든 채널 dedup·재연결·상태 관리가 단일 레지스트리에서 처리된다.
 *
 * 새 코드는 React 컨텍스트면 `useRealtimeChannel`,
 * 비-React 컨텍스트(스토어/모듈)면 `subscribeRealtime`를 직접 사용할 것.
 */
import { subscribeRealtime, type ChannelBinding } from "@/hooks/use-realtime-channel";

type PgEvent = ChannelBinding["event"];

interface SubKey {
  key: string;
  table: string;
  event?: PgEvent;
  schema?: string;
  filter?: string;
}

export function subscribePostgres(
  { key, table, event = "*", schema = "public", filter }: SubKey,
  onChange: (payload: unknown) => void,
): () => void {
  return subscribeRealtime({
    key,
    bindings: [{ event, schema, table, filter }],
    onEvent: (p) => onChange(p as unknown),
  });
}

export { subscribeRealtime };

import { useGameChannel } from "@/packages/realtime";

export function useApexSquadChannel(squadId: string, onEvent: (kind: "room" | "mirror", row: any) => void) {
  return useGameChannel({
    key: `game:apex:squad:${squadId}`,
    bindings: [
      { event: "*", schema: "public", table: "apex_squad_rooms",  filter: `id=eq.${squadId}` },
      { event: "*", schema: "public", table: "apex_squad_mirrors", filter: `squad_id=eq.${squadId}` },
    ],
    onEvent: (p: any) => onEvent(p.table === "apex_squad_rooms" ? "room" : "mirror", p.new ?? p.old),
    enabled: !!squadId,
  });
}

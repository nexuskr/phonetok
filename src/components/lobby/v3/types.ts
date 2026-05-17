export interface LobbyEmperor {
  id: string;
  nickname: string;
  tier: number;          // 1..10
  phon: number;          // for FOMO ranking
  color_hex: string;
  emoji: string;         // face emoji
  vip: boolean;
}

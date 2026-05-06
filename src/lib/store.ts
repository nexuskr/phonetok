// Lightweight client-side store (mock backend) for 폰미션
import { useEffect, useState } from "react";

export type User = {
  id: string;
  nickname: string;
  email: string;
  phone: string;
  realName: string;
  birth: string;
  referralCode?: string;
  balance: number;
  todayEarnings: number;
  streak: number;
  level: number;
  xp: number;
  isAdmin?: boolean;
};

export type MissionStatus = "available" | "in_progress" | "completed";
export type Mission = {
  id: string;
  title: string;
  desc: string;
  reward: number;
  category: "광고" | "설문" | "리뷰" | "추천" | "데이터" | "AI";
  difficulty: "EASY" | "NORMAL" | "HARD" | "VIP";
  status: MissionStatus;
  duration: string;
};

export type Pkg = {
  id: string;
  name: string;
  tagline: string;
  price: number;
  dailyReturn: number;
  duration: number; // days
  totalReturn: number;
  tier: "FOUNDER" | "GOD" | "AI" | "PHANTOM" | "EMPIRE" | "STARTER";
  perks: string[];
};

export type DepositReq = {
  id: string;
  userId: string;
  nickname: string;
  packageId: string;
  packageName: string;
  amount: number;
  screenshot?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

export type WithdrawReq = {
  id: string;
  userId: string;
  nickname: string;
  amount: number;
  bank: string;
  account: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

const KEY = "phonemission_v1";

type DB = {
  user: User | null;
  users: User[];
  deposits: DepositReq[];
  withdraws: WithdrawReq[];
  completedMissions: string[];
};

const initialDB: DB = {
  user: null,
  users: [],
  deposits: [],
  withdraws: [],
  completedMissions: [],
};

export function loadDB(): DB {
  if (typeof window === "undefined") return initialDB;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialDB;
    return { ...initialDB, ...JSON.parse(raw) };
  } catch {
    return initialDB;
  }
}

export function saveDB(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent("phonemission:update"));
}

export function useDB() {
  const [db, setDb] = useState<DB>(() => loadDB());
  useEffect(() => {
    const h = () => setDb(loadDB());
    window.addEventListener("phonemission:update", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("phonemission:update", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [db, (updater: (d: DB) => DB) => saveDB(updater(loadDB()))] as const;
}

export const PACKAGES: Pkg[] = [
  {
    id: "starter",
    name: "스타터 게이트",
    tagline: "처음 시작하는 사이버 머니의 문",
    price: 50000,
    dailyReturn: 3000,
    duration: 30,
    totalReturn: 90000,
    tier: "STARTER",
    perks: ["일일 자동 미션 5개", "기본 AI 추천", "24시간 지원"],
  },
  {
    id: "empire-founder",
    name: "Empire Founder Club",
    tagline: "제국을 세우는 자들의 첫 번째 클럽",
    price: 500000,
    dailyReturn: 38000,
    duration: 45,
    totalReturn: 1710000,
    tier: "FOUNDER",
    perks: ["프리미엄 미션 전용 풀", "즉시 정산 24/7", "1:1 매니저 배정", "VIP 텔레그램 채널"],
  },
  {
    id: "god-mode",
    name: "God Mode Empire Syndicate",
    tagline: "신의 모드 — 한계 없는 수익 시스템",
    price: 2000000,
    dailyReturn: 180000,
    duration: 45,
    totalReturn: 8100000,
    tier: "GOD",
    perks: ["무제한 VIP 미션", "AI 자동 수익 봇 제공", "월간 보너스 + 골드 등급", "프라이빗 리더보드"],
  },
  {
    id: "ai-data",
    name: "AI Data Kingdom Fund",
    tagline: "AI 데이터 왕국이 매일 당신에게 송금합니다",
    price: 5000000,
    dailyReturn: 480000,
    duration: 45,
    totalReturn: 21600000,
    tier: "AI",
    perks: ["AI 데이터 라벨링 자동 분배", "매일 4회 정산", "AI 트레이닝 수익 셰어", "전용 콘시어지"],
  },
  {
    id: "faceless",
    name: "Faceless Billionaire Program",
    tagline: "얼굴 없는 억만장자 — 프라이버시 + 자산",
    price: 10000000,
    dailyReturn: 1000000,
    duration: 50,
    totalReturn: 50000000,
    tier: "EMPIRE",
    perks: ["완전 익명 운영", "오프라인 VIP 컨퍼런스", "글로벌 송금 지원", "무제한 부스터"],
  },
  {
    id: "phantom",
    name: "Phantom Empire Council",
    tagline: "선택받은 0.01%의 팬텀 카운슬",
    price: 30000000,
    dailyReturn: 3500000,
    duration: 50,
    totalReturn: 175000000,
    tier: "PHANTOM",
    perks: ["초대 전용 — 팬텀 카운슬 멤버십", "전용 자산 매니저", "프라이빗 제트 미팅", "전 세계 라운지 액세스"],
  },
];

export const MISSIONS: Mission[] = [
  { id: "m1", title: "쿠팡 앱 설치 후 30초 실행", desc: "신규 앱 다운로드 후 메인 화면 진입", reward: 1500, category: "광고", difficulty: "EASY", status: "available", duration: "30초" },
  { id: "m2", title: "AI 챗봇 응답 평가 5건", desc: "AI 응답 품질 평가로 모델 학습 기여", reward: 4500, category: "AI", difficulty: "NORMAL", status: "available", duration: "5분" },
  { id: "m3", title: "유튜브 영상 시청 + 좋아요", desc: "지정된 영상 60초 시청", reward: 800, category: "광고", difficulty: "EASY", status: "available", duration: "1분" },
  { id: "m4", title: "10분 마켓 리서치 설문", desc: "라이프스타일 관련 설문 응답", reward: 7200, category: "설문", difficulty: "NORMAL", status: "available", duration: "10분" },
  { id: "m5", title: "프리미엄 카페 리뷰 작성", desc: "300자 이상의 솔직한 리뷰", reward: 12000, category: "리뷰", difficulty: "HARD", status: "available", duration: "20분" },
  { id: "m6", title: "VIP 데이터 라벨링 100건", desc: "고급 이미지 데이터 라벨링", reward: 35000, category: "데이터", difficulty: "VIP", status: "available", duration: "45분" },
  { id: "m7", title: "친구 1명 초대하기", desc: "추천코드로 친구 가입 시 즉시 보상", reward: 5000, category: "추천", difficulty: "NORMAL", status: "available", duration: "즉시" },
  { id: "m8", title: "AI 음성 데이터 녹음", desc: "한국어 음성 데이터 30문장 녹음", reward: 18000, category: "AI", difficulty: "HARD", status: "available", duration: "25분" },
];

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatKRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

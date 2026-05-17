/**
 * 한국 주요 은행/저축은행 목록 — 출금 계좌 선택용.
 * 표시 라벨(display)은 사용자가 익숙한 한국식 명칭. code는 금융결제원 표준 코드.
 */
export interface KoreanBank {
  code: string;
  name: string;
  display: string;
}

export const koreanBanks: readonly KoreanBank[] = [
  { code: "004", name: "KB국민은행",   display: "KB국민은행" },
  { code: "020", name: "우리은행",     display: "우리은행" },
  { code: "088", name: "신한은행",     display: "신한은행" },
  { code: "081", name: "하나은행",     display: "하나은행" },
  { code: "011", name: "NH농협은행",   display: "NH농협은행" },
  { code: "090", name: "카카오뱅크",   display: "카카오뱅크" },
  { code: "092", name: "토스뱅크",     display: "토스뱅크" },
  { code: "089", name: "케이뱅크",     display: "케이뱅크" },
  { code: "023", name: "SC제일은행",   display: "SC제일은행" },
  { code: "027", name: "한국씨티은행", display: "한국씨티은행" },
  { code: "002", name: "산업은행",     display: "산업은행" },
  { code: "003", name: "기업은행",     display: "기업은행" },
  { code: "031", name: "대구은행",     display: "대구은행" },
  { code: "032", name: "부산은행",     display: "부산은행" },
  { code: "034", name: "광주은행",     display: "광주은행" },
  { code: "035", name: "제주은행",     display: "제주은행" },
  { code: "037", name: "전북은행",     display: "전북은행" },
  { code: "039", name: "경남은행",     display: "경남은행" },
  { code: "045", name: "새마을금고",   display: "새마을금고" },
  { code: "007", name: "수협은행",     display: "수협은행" },
] as const;

export const DEFAULT_KOREAN_BANK_DISPLAY = koreanBanks[0].display;

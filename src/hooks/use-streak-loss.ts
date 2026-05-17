import { useEffect } from "react";
import { useDB } from "@/lib/store";
import { notify } from "@/lib/notify";

const KEY = "phonara:streak_loss_shown_v1";

/**
 * useStreakLoss — last_attendance가 어제보다 이전이고 streak가 0~1로 리셋된 경우
 * 사용자에게 1회 Warm King 톤 안내.
 */
export function useStreakLoss() {
  const [db] = useDB();
  useEffect(() => {
    if (typeof window === "undefined" || !db.user) return;
    const last = db.user.lastAttendance;
    const streak = db.user.attendanceStreak ?? 0;
    if (!last) return;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    // 마지막 출석이 어제도, 오늘도 아닌 경우(=하루 이상 끊김) + 스트릭 매우 낮음
    if (last < yesterday && streak <= 1) {
      const shown = localStorage.getItem(KEY);
      if (shown === last) return;
      localStorage.setItem(KEY, last);
      setTimeout(() => {
        notify.info("아쉽네요. 다시 쌓아볼까요? 첫날부터 함께 가겠습니다.");
      }, 2500);
    }
  }, [db.user?.lastAttendance, db.user?.attendanceStreak]);
}

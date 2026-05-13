/**
 * NearMissFlash — 0.5% 차이로 청산/우승 놓친 순간을 시각적으로 폭발시키는 오버레이.
 * - 외부에서 trigger() 호출
 * - 0.6s 빨간 펄스 + "0.4% 차이로 놓침!" 등 메시지
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export interface NearMissProps {
  active: boolean;
  message?: string;
  onEnd?: () => void;
}

export default function NearMissFlash({ active, message = "아쉬워요!", onEnd }: NearMissProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) return;
    setShow(true);
    const t = setTimeout(() => { setShow(false); onEnd?.(); }, 700);
    return () => clearTimeout(t);
  }, [active, onEnd]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-0 z-[85] flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-destructive/10 animate-pulse" />
          <div className="relative px-6 py-4 rounded-2xl bg-destructive/20 border-2 border-destructive/60 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-2 text-destructive font-display font-black text-xl">
              <AlertTriangle className="w-6 h-6" />
              {message}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

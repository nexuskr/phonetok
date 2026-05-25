// PHONARA unified toast — 4 tier, gold tone.
import { toast } from "sonner";

export const notify = {
  success: (msg: string, desc?: string) => toast.success(msg, { description: desc }),
  error:   (msg: string, desc?: string) => toast.error(msg,   { description: desc }),
  info:    (msg: string, desc?: string) => toast(msg,         { description: desc }),
  warn:    (msg: string, desc?: string) => toast.warning(msg, { description: desc }),
  reward:  (amount: number) => toast.success(`+${amount.toLocaleString()} PHON`, { duration: 2400 }),
};

// Singleton requestAnimationFrame scheduler.
// Coalesces multiple `schedule(fn)` calls within the same frame into a single
// flush, guaranteeing at most one emit per frame. Idle while tab is hidden.

type Task = () => void;

class RafScheduler {
  private queue = new Set<Task>();
  private rafId: number | null = null;
  private hidden = false;

  constructor() {
    if (typeof document !== "undefined") {
      this.hidden = document.hidden;
      document.addEventListener("visibilitychange", () => {
        this.hidden = document.hidden;
        if (!this.hidden && this.queue.size > 0) this.kick();
      });
    }
  }

  schedule(fn: Task) {
    this.queue.add(fn);
    this.kick();
  }

  private kick() {
    if (this.rafId != null) return;
    if (typeof requestAnimationFrame === "undefined") {
      // SSR / non-DOM fallback
      const id = setTimeout(() => this.flush(), 16) as unknown as number;
      this.rafId = id;
      return;
    }
    if (this.hidden) {
      // Tab hidden: throttle to ~4fps to avoid runaway memory growth
      const id = setTimeout(() => this.flush(), 250) as unknown as number;
      this.rafId = id;
      return;
    }
    this.rafId = requestAnimationFrame(() => this.flush());
  }

  private flush() {
    this.rafId = null;
    const tasks = Array.from(this.queue);
    this.queue.clear();
    for (const t of tasks) {
      try { t(); } catch (e) { console.error("[raf-scheduler]", e); }
    }
  }
}

export const rafScheduler = new RafScheduler();

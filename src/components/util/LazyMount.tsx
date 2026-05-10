import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Pixels of root margin (early mount before fully visible). */
  rootMargin?: string;
  /** Min height while not yet mounted (prevents layout jump). */
  minHeight?: number | string;
  /** If true, unmount when scrolled away. Default: keep mounted once visible. */
  unmountOnExit?: boolean;
}

export default function LazyMount({
  children,
  rootMargin = "200px 0px",
  minHeight = 120,
  unmountOnExit = false,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setMounted(true); return; }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setMounted(true);
          if (!unmountOnExit) io.disconnect();
        } else if (unmountOnExit) {
          setMounted(false);
        }
      }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, unmountOnExit]);

  return (
    <div ref={ref} style={!mounted ? { minHeight } : undefined}>
      {mounted ? children : null}
    </div>
  );
}

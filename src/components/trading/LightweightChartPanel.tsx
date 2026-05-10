import { useEffect, useRef } from "react";
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type Time, type IPriceLine, LineStyle } from "lightweight-charts";

interface OverlayLine { price: number; color: string; title: string; }

export default function LightweightChartPanel({
  symbol, price, overlays = [], height = 320,
}: {
  symbol: string;
  price: number;
  overlays?: OverlayLine[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const lastSymbol = useRef(symbol);

  // Init chart
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.06)" },
        horzLines: { color: "rgba(148,163,184,0.06)" },
      },
      timeScale: { timeVisible: true, secondsVisible: true, borderVisible: false },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
      width: ref.current.clientWidth,
      height,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "rgba(244,180,55,0.9)",
      topColor: "rgba(244,180,55,0.35)",
      bottomColor: "rgba(244,180,55,0.0)",
      priceLineVisible: true,
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (ref.current && chartRef.current) chartRef.current.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, [height]);

  // Reset on symbol change
  useEffect(() => {
    if (lastSymbol.current !== symbol && seriesRef.current) {
      seriesRef.current.setData([]);
      lastSymbol.current = symbol;
    }
  }, [symbol]);

  // Tick updates
  useEffect(() => {
    if (!seriesRef.current || !price) return;
    const t = (Math.floor(Date.now() / 1000)) as Time;
    seriesRef.current.update({ time: t, value: price });
  }, [price]);

  // Overlay lines
  useEffect(() => {
    const s = seriesRef.current; if (!s) return;
    linesRef.current.forEach((l) => s.removePriceLine(l));
    linesRef.current = overlays.map((o) =>
      s.createPriceLine({
        price: o.price,
        color: o.color,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: o.title,
      })
    );
  }, [overlays]);

  return (
    <div className="rounded-2xl border border-border/40 bg-background/40 p-2 sm:p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-black tracking-widest">{symbol}</span>
        <span className="text-xs font-mono tabular-nums text-amber-300">
          {price ? price.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}
        </span>
      </div>
      <div ref={ref} style={{ width: "100%", height }} />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  ColorType, LineSeries, LineStyle, LineType, createChart,
  type AutoscaleInfo, type IChartApi, type IPriceLine, type ISeriesApi, type Time,
} from "lightweight-charts";
import type { PricePoint } from "./useLiveBtcPrice";

const CHART_LINE_COLOR = "#F08E19";

const PALETTE = {
  dark:  { textMuted: "#a1a1aa", gridLine: "rgba(255,255,255,0.06)", crosshair: "rgba(255,255,255,0.18)", markerBorder: "#171717", targetLine: "#9ca3af" },
  light: { textMuted: "#71717a", gridLine: "rgba(0,0,0,0.08)",       crosshair: "rgba(0,0,0,0.15)",       markerBorder: "#fafafa", targetLine: "#71717a" },
} as const;

function mergeTargetIntoAutoscale(orig: () => AutoscaleInfo | null, target: number | null): AutoscaleInfo | null {
  if (!target || !Number.isFinite(target)) return orig();
  const base = orig();
  if (!base?.priceRange) return { priceRange: { minValue: target - 25, maxValue: target + 25 } };
  const lo = Math.min(base.priceRange.minValue, target);
  const hi = Math.max(base.priceRange.maxValue, target);
  const pad = Math.max(hi - lo, 1) * 0.07;
  return { priceRange: { minValue: lo - pad, maxValue: hi + pad } };
}

interface Props { history: PricePoint[]; priceToBeat?: number | null; height?: number; }

export function BtcLiveChart({ history, priceToBeat, height = 300 }: Props) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const c = PALETTE[theme];
  const ptbRef = useRef<number | null>(null);
  ptbRef.current = priceToBeat ?? null;

  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const seriesRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const targetLineRef = useRef<IPriceLine | null>(null);
  const countRef      = useRef(0);
  const headRef       = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: c.textMuted, fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: c.gridLine } },
      width: el.clientWidth, height,
      timeScale: { visible: false, borderVisible: false, rightOffset: 4, barSpacing: 0.4 },
      rightPriceScale: { borderVisible: false },
      leftPriceScale: { visible: false },
      crosshair: { vertLine: { color: c.crosshair, style: LineStyle.Dashed, width: 1 }, horzLine: { color: c.crosshair, style: LineStyle.Dashed, width: 1 } },
      handleScroll: false, handleScale: false,
    });
    const series = chart.addSeries(LineSeries, {
      color: CHART_LINE_COLOR, lineWidth: 3, lineType: LineType.Curved,
      crosshairMarkerBackgroundColor: CHART_LINE_COLOR, crosshairMarkerBorderColor: c.markerBorder,
      lastValueVisible: true, priceLineVisible: false,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      autoscaleInfoProvider: (orig: () => AutoscaleInfo | null) => mergeTargetIntoAutoscale(orig, ptbRef.current),
    });
    chartRef.current = chart; seriesRef.current = series;
    countRef.current = 0; headRef.current = null;

    const ro = new ResizeObserver((e) => chart.applyOptions({ width: e[0].contentRect.width }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, [height, theme, c]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (history.length === 0) { series.setData([]); countRef.current = 0; headRef.current = null; return; }

    const headT = history[0].time;
    const needsFull = countRef.current === 0 || history.length < countRef.current || headRef.current !== headT;
    if (needsFull) {
      series.setData(history.map((p) => ({ time: p.time as Time, value: p.value })));
      countRef.current = history.length; headRef.current = headT;
    } else {
      for (let i = countRef.current; i < history.length; i++) series.update({ time: history[i].time as Time, value: history[i].value });
      countRef.current = history.length;
      chartRef.current?.timeScale().scrollToRealTime();
    }
    chartRef.current?.priceScale("right").setAutoScale(true);
  }, [history]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (targetLineRef.current) { series.removePriceLine(targetLineRef.current); targetLineRef.current = null; }
    if (!priceToBeat || !Number.isFinite(priceToBeat)) return;
    targetLineRef.current = series.createPriceLine({ price: priceToBeat, color: c.targetLine, lineWidth: 2, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: "Target" });
    chartRef.current?.priceScale("right").setAutoScale(true);
    return () => { if (seriesRef.current && targetLineRef.current) seriesRef.current.removePriceLine(targetLineRef.current!); };
  }, [priceToBeat, c]);

  return <div className="relative w-full" style={{ height }}><div ref={containerRef} className="h-full w-full" /></div>;
}

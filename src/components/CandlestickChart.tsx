import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
import { Candle, IndicatorResults } from '../types/market';
import { Maximize2, Eye, EyeOff } from 'lucide-react';

interface CandlestickChartProps {
  candles: Candle[];
  indicators: IndicatorResults;
  symbol: string;
  interval: string;
  setInterval: (int: '15m' | '1h' | '4h') => void;
  isLoading: boolean;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  indicators,
  symbol,
  interval,
  setInterval,
  isLoading,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  const [crosshairData, setCrosshairData] = useState<{
    time?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    changePct?: number;
  } | null>(null);

  // Initialize and clean up chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'monospace, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
      },
      crosshair: {
        mode: 1, // Magnet
        vertLine: {
          color: 'rgba(148, 163, 184, 0.4)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: 'rgba(148, 163, 184, 0.4)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22, // leave room for volume
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });
    candleSeriesRef.current = candleSeries;

    // Add EMA 20
    const ema20Series = chart.addSeries(LineSeries, {
      color: '#38bdf8', // Cyan
      lineWidth: 1.5 as any,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: 'EMA 20',
    });
    ema20SeriesRef.current = ema20Series;

    // Add EMA 50
    const ema50Series = chart.addSeries(LineSeries, {
      color: '#f59e0b', // Amber
      lineWidth: 1.5 as any,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: 'EMA 50',
    });
    ema50SeriesRef.current = ema50Series;

    // Add Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#64748b',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setCrosshairData(null);
        return;
      }

      const cData = param.seriesData.get(candleSeries) as any;
      const vData = param.seriesData.get(volumeSeries) as any;

      if (cData) {
        const o = cData.open;
        const c = cData.close;
        const changePct = o > 0 ? ((c - o) / o) * 100 : 0;
        const timeStr = typeof param.time === 'number'
          ? new Date(param.time * 1000).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          : String(param.time);

        setCrosshairData({
          time: timeStr,
          open: o,
          high: cData.high,
          low: cData.low,
          close: c,
          volume: vData?.value,
          changePct,
        });
      } else {
        setCrosshairData(null);
      }
    });

    // Resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update Data
  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return;

    // Sort candles chronologically & format
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

    // Format candlesticks
    const candleData = sortedCandles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeriesRef.current.setData(candleData);

    // Format volume
    if (volumeSeriesRef.current) {
      const volData = sortedCandles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      }));
      volumeSeriesRef.current.setData(volData);
    }

    // Format EMA 20
    if (ema20SeriesRef.current && indicators.ema20) {
      const ema20Data: { time: Time; value: number }[] = [];
      for (let i = 0; i < sortedCandles.length; i++) {
        const val = indicators.ema20[i];
        if (val !== null && val !== undefined) {
          ema20Data.push({ time: sortedCandles[i].time as Time, value: val });
        }
      }
      ema20SeriesRef.current.setData(ema20Data);
    }

    // Format EMA 50
    if (ema50SeriesRef.current && indicators.ema50) {
      const ema50Data: { time: Time; value: number }[] = [];
      for (let i = 0; i < sortedCandles.length; i++) {
        const val = indicators.ema50[i];
        if (val !== null && val !== undefined) {
          ema50Data.push({ time: sortedCandles[i].time as Time, value: val });
        }
      }
      ema50SeriesRef.current.setData(ema50Data);
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, indicators]);

  // Visibility toggles
  useEffect(() => {
    if (ema20SeriesRef.current) {
      ema20SeriesRef.current.applyOptions({ visible: showEma20 });
    }
  }, [showEma20]);

  useEffect(() => {
    if (ema50SeriesRef.current) {
      ema50SeriesRef.current.applyOptions({ visible: showEma50 });
    }
  }, [showEma50]);

  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({ visible: showVolume });
    }
  }, [showVolume]);

  const handleFitContent = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
      {/* Chart Top Controls & Indicator Overlays */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs">
        {/* Left: Indicator Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEma20(!showEma20)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded font-mono transition-colors border ${
              showEma20
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                : 'text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Exponential Moving Average 20"
          >
            <span className="w-2 h-0.5 bg-sky-400 inline-block"></span>
            <span>EMA 20</span>
          </button>

          <button
            onClick={() => setShowEma50(!showEma50)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded font-mono transition-colors border ${
              showEma50
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Exponential Moving Average 50"
          >
            <span className="w-2 h-0.5 bg-amber-400 inline-block"></span>
            <span>EMA 50</span>
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded font-mono transition-colors border ${
              showVolume
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Volume Sub-Panel"
          >
            {showVolume ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>VOL</span>
          </button>
        </div>

        {/* Center / Inspection values (OHLC on hover) */}
        <div className="hidden xl:flex items-center gap-3 font-mono text-[11px] text-slate-400 tabular-nums">
          {crosshairData ? (
            <>
              <span>{crosshairData.time}</span>
              <span>O: <span className="text-slate-200">${crosshairData.open?.toFixed(2)}</span></span>
              <span>H: <span className="text-slate-200">${crosshairData.high?.toFixed(2)}</span></span>
              <span>L: <span className="text-slate-200">${crosshairData.low?.toFixed(2)}</span></span>
              <span>C: <span className="text-slate-200">${crosshairData.close?.toFixed(2)}</span></span>
              {crosshairData.volume !== undefined && (
                <span>V: <span className="text-slate-200">{crosshairData.volume.toFixed(2)} BTC</span></span>
              )}
              {crosshairData.changePct !== undefined && (
                <span className={crosshairData.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {crosshairData.changePct >= 0 ? '+' : ''}{crosshairData.changePct.toFixed(2)}%
                </span>
              )}
            </>
          ) : lastCandle ? (
            <>
              <span className="text-slate-400">Latest Closed:</span>
              <span>O: ${lastCandle.open.toFixed(2)}</span>
              <span>H: ${lastCandle.high.toFixed(2)}</span>
              <span>L: ${lastCandle.low.toFixed(2)}</span>
              <span>C: ${lastCandle.close.toFixed(2)}</span>
              <span>V: {lastCandle.volume.toFixed(1)} BTC</span>
            </>
          ) : null}
        </div>

        {/* Right: Controls & Fit button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFitContent}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded border border-slate-700 transition-colors"
            title="Fit candles to width"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="relative w-full h-[460px] bg-[#090d16]">
        {isLoading && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10">
            <div className="text-xs font-mono text-slate-400 animate-pulse">
              Streaming OHLCV candlestick data...
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

      {/* Footer bar with candle count & timeframe */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900 border-t border-slate-800 text-[11px] font-mono text-slate-400">
        <div>
          <span>Resolution: </span>
          <span className="text-amber-400">{interval}</span>
          <span className="text-slate-400"> · </span>
          <span>Bars Loaded: </span>
          <span className="text-slate-300">{candles.length}</span>
        </div>
        <div>
          <span>Scale: Linear · Time: UTC</span>
        </div>
      </div>
    </div>
  );
};

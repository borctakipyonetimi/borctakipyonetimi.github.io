/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import * as d3 from "d3";
import { useCurrency } from "../utils/CurrencyContext";
import { InstallmentDebt } from "../types";

// Helper to convert polar coordinates to Cartesian for SVG circles/doughnuts
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
}

interface DoughnutChartProps {
  data: { label: string; value: number; color: string }[];
  type?: "income" | "expense";
}

export const DoughnutChart: React.FC<DoughnutChartProps> = ({ data, type = "expense" }) => {
  const { format } = useCurrency();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm font-medium text-slate-400">
        Gösterilecek veri yok
      </div>
    );
  }

  // D3 Pie layout definition
  const pieGenerator = d3.pie<{ label: string; value: number; color: string }>()
    .value(d => d.value)
    .sort(null);

  const arcs = pieGenerator(data);

  // Determine active item to display in the centerpiece
  const activeItem = hoveredIndex !== null ? data[hoveredIndex] : null;
  const activePercent = activeItem ? ((activeItem.value / total) * 100).toFixed(1) : "";

  return (
    <div className="flex flex-col items-center justify-center p-2 xl:flex-row gap-4 xl:gap-6">
      {/* Interactive Bento HUD SVG Box */}
      <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
        {/* Animated ambient decorative glow */}
        <div 
          className="absolute inset-4 rounded-full blur-2xl opacity-10 dark:opacity-20 transition-all duration-700 pointer-events-none"
          style={{
            backgroundColor: activeItem ? activeItem.color : "rgb(99, 102, 241)",
          }}
        />

        <svg viewBox="0 0 150 150" className="w-full h-full transform -rotate-90 select-none relative z-10 overflow-visible">
          {/* SVG Definitions for 3D Translucent Slices */}
          <defs>
            {data.map((item, idx) => {
              const gradId = `slice-grad-${idx}`;
              return (
                <linearGradient key={idx} id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={item.color} stopOpacity={1} />
                  <stop offset="50%" stopColor={item.color} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0.5} />
                </linearGradient>
              );
            })}
          </defs>

          {/* Futuristic Slow Spinning Outer Starburst HUD Ring - Enclosed inside custom centered motion.g */}
          <motion.g
            style={{ transformOrigin: "75px 75px" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          >
            <circle
              cx="75"
              cy="75"
              r="64"
              fill="none"
              stroke="rgba(148, 163, 184, 0.15)"
              strokeWidth="1"
              strokeDasharray="4 8"
              className="pointer-events-none"
            />
          </motion.g>

          {/* Micro Orbit Track Ring (Inner Core) - Enclosed inside custom centered motion.g */}
          <motion.g
            style={{ transformOrigin: "75px 75px" }}
            animate={{ rotate: -360 }}
            transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
          >
            <circle
              cx="75"
              cy="75"
              r="23"
              fill="none"
              stroke="rgba(148, 163, 184, 0.18)"
              strokeWidth="0.75"
              strokeDasharray="2 3"
              className="pointer-events-none"
            />
          </motion.g>

          {/* Centered Slices rendering inside translated SVG Group */}
          <g transform="translate(75, 75)">
            {arcs.map((arc, idx) => {
              const isHovered = hoveredIndex === idx;
              
              // Generate the SVG path utilizing D3's arc parameters
              // Centered at translated (0,0) -> (75,75)
              const arcPath = d3.arc<any, any>()({
                innerRadius: isHovered ? 26 : 32,
                outerRadius: isHovered ? 58 : 50,
                startAngle: arc.startAngle,
                endAngle: arc.endAngle,
                padAngle: 0.025,
                cornerRadius: 5,
              }) || "";

              return (
                <g key={idx} className="cursor-pointer">
                  {/* Visual underlay shadow slice */}
                  {isHovered && (
                    <path
                      d={arcPath}
                      fill={arc.data.color}
                      opacity="0.25"
                      className="origin-center"
                      style={{
                        transform: "scale(1.05)",
                        filter: `blur(4px)`,
                      }}
                    />
                  )}
                  
                  {/* Main Render Slice Segment */}
                  <motion.path
                    d={arcPath}
                    fill={`url(#slice-grad-${idx})`}
                    stroke={isHovered ? "#ffffff" : "transparent"}
                    strokeWidth={isHovered ? 1.5 : 0}
                    className="transition-all duration-300 ease-out origin-center"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    whileHover={{ scale: 1.04 }}
                    animate={{
                      opacity: hoveredIndex === null || isHovered ? 1 : 0.45,
                    }}
                    style={{
                      filter: isHovered 
                        ? `drop-shadow(0px 8px 16px ${arc.data.color}50) brightness(1.15)` 
                        : "drop-shadow(0px 1px 3px rgba(0,0,0,0.05))",
                    }}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Dynamic HUD Informative Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center z-20">
          {activeItem ? (
            <motion.div 
              key={`hud-active-${activeItem.label}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-0.5 max-w-full"
            >
              <span 
                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block truncate max-w-[110px]"
                style={{ backgroundColor: `${activeItem.color}15`, color: activeItem.color }}
              >
                {activeItem.label}
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-50 font-mono block leading-none pt-1">
                {format(activeItem.value)}
              </span>
              <span className="text-[10px] font-black text-slate-550 dark:text-slate-400 block leading-none">
                %{activePercent} pay
              </span>
            </motion.div>
          ) : (
            <motion.div 
              key="hud-default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-0.5"
            >
              <span className="text-[9px] text-slate-450 dark:text-slate-500 font-black uppercase tracking-widest block">
                {type === "income" ? "TOPLAM GELİR" : "TOPLAM GİDER"}
              </span>
              <span className="text-base font-black text-slate-900 dark:text-white font-mono block leading-none">
                {format(total)}
              </span>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 block">
                {data.length} {type === "income" ? "Gelir Grubu" : "Kategori Masrafı"}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Proportional Staggered Progress Legend Grid */}
      <div className="flex-1 w-full min-w-[140px] space-y-2 relative z-10">
        {data.map((item, idx) => {
          const isHovered = hoveredIndex === idx;
          const percentage = ((item.value / total) * 105).toFixed(0); // scale up indicator fill
          const displayPercentage = ((item.value / total) * 100).toFixed(0);

          return (
            <div
              key={idx}
              className={`p-2.5 rounded-2xl transition-all duration-300 border cursor-pointer ${
                isHovered 
                  ? "bg-white dark:bg-slate-850 scale-[1.03] shadow-md border-slate-200 dark:border-slate-800" 
                  : "bg-slate-50/40 dark:bg-slate-900/40 border-transparent hover:bg-slate-50 dark:hover:bg-slate-850/50"
              }`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                borderColor: isHovered ? item.color : "transparent",
                boxShadow: isHovered ? `0 4px 12px ${item.color}10` : "none"
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span 
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ${isHovered ? "scale-125" : ""}`} 
                    style={{ 
                      backgroundColor: item.color,
                      boxShadow: isHovered ? `0 0 10px ${item.color}` : "none"
                    }} 
                  />
                  <span className={`text-xs truncate transition-all duration-300 ${
                    isHovered 
                      ? "font-black text-slate-900 dark:text-white" 
                      : "text-slate-650 dark:text-slate-350 font-bold"
                  }`}>
                    {item.label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-mono font-black transition-all duration-305 ${
                    isHovered ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-250"
                  }`}>
                    {format(item.value)}
                  </span>
                </div>
              </div>

              {/* Progress Bar Column Pill (Neon fill representing percentage share) */}
              <div className="w-full bg-slate-200/50 dark:bg-slate-800/60 h-2 rounded-full overflow-hidden relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, Number(displayPercentage)))}%` }}
                  transition={{ duration: 0.85, ease: "easeOut" }}
                  className="h-full rounded-full transition-colors"
                  style={{ 
                    backgroundColor: item.color,
                    opacity: isHovered ? 1 : 0.75,
                    boxShadow: isHovered ? `0 0 6px ${item.color}` : "none"
                  }}
                />
                
                {/* Percentage Marker Badge */}
                <span className="absolute right-1 text-[8px] font-bold text-slate-400 font-mono tracking-tighter leading-none top-1/2 -translate-y-1/2 select-none opacity-0 hover:opacity-100 transition-opacity duration-300">
                  %{displayPercentage}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[8.5px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                <span>PAY DEĞERİ</span>
                <span className={isHovered ? "text-indigo-500 font-black" : ""}>%{displayPercentage} HARCAMA</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};;

interface BarChartProps {
  data: { label: string; value: number; color: string }[];
}

export const BarChart: React.FC<BarChartProps> = ({ data }) => {
  const { format } = useCurrency();
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 100);

  return (
    <div className="flex flex-col gap-4 w-full p-2">
      {data.map((item, idx) => {
        const percentage = Math.min((Math.abs(item.value) / maxVal) * 100, 100);
        return (
          <div key={idx} className="flex flex-col gap-1 w-full scale-100 transition-transform active:scale-[0.99]">
            <div className="flex justify-between items-center text-xs md:text-sm">
              <span className="font-semibold text-slate-600 dark:text-slate-300">{item.label}</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                {item.value < 0 ? "-" : ""}{format(Math.abs(item.value))}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-5 rounded-full overflow-hidden flex shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface LineChartProps {
  labels: string[];
  values: number[];
  lineColor: string;
}

export const LineChart: React.FC<LineChartProps> = ({ labels, values, lineColor }) => {
  const { format } = useCurrency();
  const maxVal = Math.max(...values, 100);
  const minVal = Math.min(...values, 0);
  const spread = maxVal - minVal || 1;

  // Viewbox Dimensions
  const w = 400;
  const h = 180;
  const padding = 25;

  const points = values.map((val, idx) => {
    const x = padding + (idx / (values.length - 1 || 1)) * (w - padding * 2);
    const y = h - padding - ((val - minVal) / spread) * (h - padding * 2);
    return { x, y };
  });

  let linePath = "";
  let areaPath = "";

  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    areaPath = `M ${points[0].x} ${h - padding}`;
    areaPath += ` L ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      // Curved lines using cubic Bezier
      const cpX1 = points[i - 1].x + (points[i].x - points[i - 1].x) / 2;
      const cpY1 = points[i - 1].y;
      const cpX2 = points[i - 1].x + (points[i].x - points[i - 1].x) / 2;
      const cpY2 = points[i].y;

      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y}`;
      areaPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y}`;
    }

    areaPath += ` L ${points[points.length - 1].x} ${h - padding} Z`;
  }

  return (
    <div className="w-full p-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {/* Shadow definitions for curves */}
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* X-Grid lines */}
        <line x1={padding} y1={h - padding} x2={w - padding} y2={h - padding} stroke="#94a3b8" strokeWidth="1" className="opacity-30" />
        <line x1={padding} y1={padding} x2={w - padding} y2={padding} stroke="#94a3b8" strokeWidth="1" className="opacity-10" />

        {/* Filled Path under line */}
        {points.length > 1 && (
          <path d={areaPath} fill="url(#areaGradient)" className="transition-all duration-500" />
        )}

        {/* Stroke Line */}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        )}

        {/* Dots over coordinates */}
        {points.map((pt, idx) => (
          <g key={idx} className="group cursor-pointer">
            <circle
              cx={pt.x}
              cy={pt.y}
              r="4.5"
              fill="#ffffff"
              stroke={lineColor}
              strokeWidth="2.5"
              className="transition-all duration-150 hover:r-[6.5] active:scale-[1.1]"
            />
            <text
              x={pt.x}
              y={pt.y - 10}
              textAnchor="middle"
              className="text-[9px] font-bold fill-slate-700 dark:fill-slate-200 font-mono"
            >
              {format(values[idx])}
            </text>
          </g>
        ))}

        {/* Labels below */}
        {labels.map((lbl, idx) => {
          const x = padding + (idx / (labels.length - 1 || 1)) * (w - padding * 2);
          return (
            <text
              key={idx}
              x={x}
              y={h - 10}
              textAnchor="middle"
              className="text-[9px] font-semibold fill-slate-400 dark:fill-slate-500"
            >
              {lbl}
            </text>
          );
        })}
      </svg>
    </div>
  );
};


interface InstallmentsPortalChartProps {
  installmentDebts: InstallmentDebt[];
}

export const InstallmentsPortalChart: React.FC<InstallmentsPortalChartProps> = ({ installmentDebts }) => {
  const { format } = useCurrency();
  const [hoveredRingIndex, setHoveredRingIndex] = useState<number | null>(null);
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  if (!installmentDebts || installmentDebts.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium bg-slate-50/20 dark:bg-slate-800/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
        📈 Grafik ve Zaman Projeksiyonu için yukarıdaki "Taksit Planı Ekle" butonuyla yeni bir plan kaydedebilirsiniz.
      </div>
    );
  }

  // Pre-configured bright neon colors for distinct debts
  const ringColors = [
    "#6366f1", // Indigo
    "#06b6d4", // Cyan
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ec4899", // Pink
    "#8b5cf6", // Purple
    "#ef4444", // Red
  ];

  // Limit rings to the top 6 largest active debts for visual clarity, otherwise it gets too dense
  const activeDebts = installmentDebts.filter(d => d.paidInstallmentCount < d.installmentCount);
  const debtsToPlot = activeDebts.length > 0 
    ? [...activeDebts].sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5) 
    : [...installmentDebts].slice(0, 5);

  // Helper date function in Turkish for the future projection
  const getFutureMonthLabel = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  };

  const getFutureMonthShort = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return d.toLocaleDateString("tr-TR", { month: "short" });
  };

  // Calculates the simulated state of all installments at a given month offset
  const getSimulatedRemainingTotal = (offset: number) => {
    return installmentDebts.reduce((sum, inst) => {
      const monthlyVal = inst.totalAmount / inst.installmentCount;
      const simulatedPaid = Math.min(inst.installmentCount, inst.paidInstallmentCount + offset);
      const simulatedRemaining = (inst.installmentCount - simulatedPaid) * monthlyVal;
      return sum + simulatedRemaining;
    }, 0);
  };

  const currentRemainingTotal = getSimulatedRemainingTotal(0);
  const simulatedRemainingTotal = getSimulatedRemainingTotal(selectedMonthOffset);
  const totalOriginalDebt = installmentDebts.reduce((sum, inst) => sum + inst.totalAmount, 0);

  // Calculates 12-Month repayment projection curve coordinates
  const projectionRange = Array.from({ length: 12 }, (_, i) => i);
  const curvePoints = projectionRange.map(m => {
    return {
      offset: m,
      label: getFutureMonthShort(m),
      fullLabel: getFutureMonthLabel(m),
      value: getSimulatedRemainingTotal(m),
    };
  });

  const maxVal = Math.max(...curvePoints.map(p => p.value), 100);

  // Grid / Curve Dimensions for standard responsive SVG
  const curveW = 340;
  const curveH = 120;
  const padX = 25;
  const padY = 15;

  const svgCoordinates = curvePoints.map((pt, i) => {
    const x = padX + (i / 11) * (curveW - 2 * padX);
    const y = curveH - padY - (pt.value / maxVal) * (curveH - 2 * padY);
    return { x, y, pt };
  });

  // Calculate curve SVG path
  let pathString = "";
  let gradientPathString = "";

  if (svgCoordinates.length > 0) {
    pathString = `M ${svgCoordinates[0].x} ${svgCoordinates[0].y}`;
    gradientPathString = `M ${svgCoordinates[0].x} ${curveH - padY} L ${svgCoordinates[0].x} ${svgCoordinates[0].y}`;

    for (let i = 1; i < svgCoordinates.length; i++) {
      const prev = svgCoordinates[i - 1];
      const curr = svgCoordinates[i];
      const cpX1 = prev.x + (curr.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (curr.x - prev.x) / 2;
      const cpY2 = curr.y;

      pathString += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
      gradientPathString += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }

    gradientPathString += ` L ${svgCoordinates[svgCoordinates.length - 1].x} ${curveH - padY} Z`;
  }

  // Active highlighted item details during ring hover
  const activeHoveredDebt = hoveredRingIndex !== null ? debtsToPlot[hoveredRingIndex] : null;

  return (
    <div className="bg-slate-900/95 dark:bg-slate-950/40 text-white rounded-3xl p-5 shadow-xl border border-slate-800 space-y-5 animate-fade-in relative overflow-hidden backdrop-blur-xs">
      {/* Absolute futuristic decorative radial grids in background */}
      <div className="absolute -right-16 -top-16 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-44 h-44 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-black uppercase text-indigo-400 tracking-widest flex items-center gap-1.5 leading-none">
            ⚡ TAKSİT ZAMAN MAKİNESİ
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-tight font-medium">
            Taksitlerinizin zaman içindeki gelecekteki erime durumunu interaktif olarak simüle edin!
          </p>
        </div>

        {/* Time machine controller slider tabs */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl self-start md:self-auto shadow-inner border border-slate-700/50">
          {[0, 1, 3, 6, 12].map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonthOffset(m)}
              className={`px-2 py-1 text-[9px] font-black tracking-wider uppercase rounded-lg transition-all cursor-pointer ${
                selectedMonthOffset === m
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m === 0 ? "Şimdi" : `+${m} Ay`}
            </button>
          ))}
        </div>
      </div>

      {/* Toplam ve Kalan Taksitli Borç Göstergeleri */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        <div className="p-3.5 bg-slate-850/60 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none mb-1">
              TOPLAM TAKSİTLİ BORÇ
            </span>
            <span className="text-base font-black text-indigo-400 font-mono">
              {format(totalOriginalDebt)}
            </span>
          </div>
          <div className="text-indigo-400 text-lg">💳</div>
        </div>

        <div className="p-3.5 bg-slate-850/60 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none mb-1">
              KALAN TAKSİTLİ BORÇ
            </span>
            <span className="text-base font-black text-rose-400 font-mono">
              {format(currentRemainingTotal)}
            </span>
          </div>
          <div className="text-rose-400 text-lg">⏳</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12 items-center">
        {/* Left Column: Concentric Portal Interactive Orbit */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-40 h-40 shrink-0">
            <svg viewBox="0 0 150 150" className="w-full h-full select-none transform -rotate-90">
              <defs>
                <filter id="neon-tracer" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Outer boundary security decorative ring */}
              <circle cx="75" cy="75" r="72" fill="none" stroke="#334155" strokeWidth="0.5" strokeDasharray="3, 3" className="opacity-40" />

              {/* Loop and draw nested colorful tracks for each installment */}
              {debtsToPlot.map((inst, idx) => {
                const r = 26 + idx * 8.5; // concentric radii
                const circumference = 2 * Math.PI * r;
                
                const currentPaid = inst.paidInstallmentCount;
                const simulatedPaid = Math.min(inst.installmentCount, currentPaid + selectedMonthOffset);
                const progressPercentage = (simulatedPaid / inst.installmentCount) * 100;

                const color = ringColors[idx % ringColors.length];
                const isHovered = hoveredRingIndex === idx;

                const strokeOffset = circumference * (1 - progressPercentage / 100);

                return (
                  <g 
                    key={inst.id} 
                    className="cursor-pointer transition-all duration-300"
                    onMouseEnter={() => setHoveredRingIndex(idx)}
                    onMouseLeave={() => setHoveredRingIndex(null)}
                  >
                    {/* Shadow track */}
                    <circle
                      cx="75"
                      cy="75"
                      r={r}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth={isHovered ? 6 : 4}
                      className="transition-all duration-200 opacity-60"
                    />

                    {/* Faint color track for aesthetic depth */}
                    <circle
                      cx="75"
                      cy="75"
                      r={r}
                      fill="none"
                      stroke={color}
                      strokeWidth={isHovered ? 6 : 4}
                      className="opacity-10 transition-all duration-200"
                    />

                    {/* Animated Filled Progress arc */}
                    <circle
                      cx="75"
                      cy="75"
                      r={r}
                      fill="none"
                      stroke={color}
                      strokeWidth={isHovered ? 7.5 : 4.5}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                      style={{
                        filter: isHovered ? "url(#neon-tracer)" : "none",
                      }}
                    />

                    {/* Orbit Head Spark Particle */}
                    {progressPercentage > 0 && progressPercentage < 100 && (
                      <circle
                        cx={75 + r * Math.cos((progressPercentage / 100) * 2 * Math.PI)}
                        cy={75 + r * Math.sin((progressPercentage / 100) * 2 * Math.PI)}
                        r="3"
                        fill="#ffffff"
                        style={{
                          filter: "drop-shadow(0px 0px 4px #ffffff)",
                          opacity: isHovered ? 1 : 0.7
                        }}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Portal Inside HUD Panel display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center pointer-events-none">
              {activeHoveredDebt ? (
                <div className="animate-fade-in space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider leading-none">
                    SEÇİLEN
                  </span>
                  <span 
                    className="text-[11px] font-black truncate max-w-[100px] block"
                    style={{ color: ringColors[debtsToPlot.indexOf(activeHoveredDebt) % ringColors.length] }}
                  >
                    {activeHoveredDebt.name}
                  </span>
                  <span className="text-[12px] font-black font-mono block leading-none">
                    {format(activeHoveredDebt.totalAmount / activeHoveredDebt.installmentCount)}/ay
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 block leading-none">
                    {Math.min(activeHoveredDebt.installmentCount, activeHoveredDebt.paidInstallmentCount + selectedMonthOffset)}/{activeHoveredDebt.installmentCount} Ay
                  </span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {selectedMonthOffset > 0 ? (
                    <>
                      <span className="text-[9px] font-black text-rose-400 block tracking-wider uppercase leading-none">
                        +{selectedMonthOffset} AY SONRA
                      </span>
                      <span className="text-xs text-rose-500 font-black font-mono block animate-pulse">
                        {format(simulatedRemainingTotal)}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 block leading-none">
                        Azalma: %{currentRemainingTotal > 0 ? (((currentRemainingTotal - simulatedRemainingTotal) / currentRemainingTotal) * 100).toFixed(0) : 0}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[9px] font-black text-indigo-400 block tracking-wider uppercase leading-none">
                        BUGÜN
                      </span>
                      <span className="text-xs text-indigo-300 font-black font-mono block">
                        {format(currentRemainingTotal)}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 block leading-none">
                        Kalan Toplam Borç
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="text-[9px] text-slate-400 font-extrabold tracking-wide mt-2">
            * İnteraktif halkalar üzerine gelip detay inceleyin
          </div>
        </div>

        {/* Right Column: Beautiful Repayment Wave Slope & Stats breakdown */}
        <div className="md:col-span-7 space-y-4">
          {/* Dynamic Info alert block */}
          <div className="p-3 bg-slate-800/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-[9px] text-indigo-400 uppercase font-black block">Projeksiyon Zamanı</span>
              <span className="text-xs font-black text-white block">
                🚀 {getFutureMonthLabel(selectedMonthOffset)} Gelecek Hedefi
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-emerald-400 uppercase font-black block leading-none">Simüle Edilen Ödeme</span>
              <span className="text-xs font-bold text-emerald-400 font-mono block mt-0.5">
                + {format(currentRemainingTotal - simulatedRemainingTotal)} Ödenecek
              </span>
            </div>
          </div>

          {/* D3 Styled Repayment Wave Chart */}
          <div className="relative p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
            <div className="flex items-center justify-between text-[10px] font-black text-indigo-400 uppercase pb-1.5 px-1 bg-none">
              <span>📉 Taksit Borç Erime Eğrisi (12 Ay)</span>
              {hoveredPointIndex !== null && (
                <span className="text-emerald-400 normal-case font-bold animate-fade-in">
                  {curvePoints[hoveredPointIndex].label}: {format(curvePoints[hoveredPointIndex].value)}
                </span>
              )}
            </div>

            <svg viewBox={`0 0 ${curveW} ${curveH}`} className="w-full h-auto">
              <defs>
                <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              <line x1={padX} y1={curveH - padY} x2={curveW - padX} y2={curveH - padY} stroke="#1e293b" strokeWidth="1" />
              <line x1={padX} y1={padY} x2={curveW - padX} y2={padY} stroke="#1e293b" strokeWidth="1" strokeDasharray="2, 2" />

              {/* Gradient filled area */}
              {curvePoints.length > 1 && (
                <path d={gradientPathString} fill="url(#waveFill)" className="transition-all duration-300 pointer-events-none" />
              )}

              {/* Glowing Line */}
              {curvePoints.length > 1 && (
                <path
                  d={pathString}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="transition-all duration-300 pointer-events-none"
                />
              )}

              {/* Render interactive dots with touch/click areas */}
              {svgCoordinates.map((coord, i) => {
                const isSelected = selectedMonthOffset === coord.pt.offset;
                const isPointHovered = hoveredPointIndex === i;

                return (
                  <g 
                    key={i} 
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPointIndex(i)}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                    onClick={() => setSelectedMonthOffset(coord.pt.offset)}
                  >
                    {/* Visual dot tracer */}
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={isSelected ? 4.5 : isPointHovered ? 4 : 2}
                      fill={isSelected ? "#10b981" : isPointHovered ? "#6366f1" : "#475569"}
                      stroke="#0f172a"
                      strokeWidth={isSelected || isPointHovered ? 2 : 0}
                      className="transition-all duration-150"
                    />

                    {/* Dynamic pulse outer bubble */}
                    {isSelected && (
                      <circle
                        cx={coord.x}
                        cy={coord.y}
                        r="8"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1"
                        className="animate-ping"
                      />
                    )}

                    {/* Labels at standard interval points for clean readability */}
                    {(i === 0 || i === 3 || i === 6 || i === 9 || i === 11) && (
                      <text
                        x={coord.x}
                        y={curveH - 4}
                        textAnchor="middle"
                        className="text-[8px] fill-slate-400 font-bold"
                      >
                        {coord.pt.label}
                      </text>
                    )}

                    {/* Invisible fat mouse interaction target */}
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r="12"
                      fill="transparent"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Color Indicators Legend Lists */}
          <div className="grid grid-cols-2 gap-1.5 max-h-[85px] overflow-y-auto pr-1">
            {debtsToPlot.map((inst, idx) => {
              const color = ringColors[idx % ringColors.length];
              const isHovered = hoveredRingIndex === idx;
              return (
                <div
                  key={inst.id}
                  className={`flex items-center gap-2 p-1 rounded-lg transition-all duration-150 cursor-pointer ${
                    isHovered ? "bg-slate-800" : "hover:bg-slate-850"
                  }`}
                  onMouseEnter={() => setHoveredRingIndex(idx)}
                  onMouseLeave={() => setHoveredRingIndex(null)}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-semibold truncate flex-1 text-slate-300">
                    {inst.name}
                  </span>
                  <span className="text-[9px] font-bold font-mono text-slate-400 shrink-0">
                    {inst.paidInstallmentCount}/{inst.installmentCount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};


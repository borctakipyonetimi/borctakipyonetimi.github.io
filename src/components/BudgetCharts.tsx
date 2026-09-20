/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as d3 from "d3";
import { useCurrency } from "../utils/CurrencyContext";
import { InstallmentDebt } from "../types";
import { Sparkles, TrendingUp, ShieldCheck, Activity, Zap } from "lucide-react";

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
      <div className="flex flex-col h-56 items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-2">
        <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 animate-pulse" />
        <span>Gösterilecek finansal veri bulunmuyor</span>
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
    <div className="flex flex-col items-center justify-center gap-5 w-full">
      {/* Interactive Bento HUD SVG Box */}
      <div className="relative w-52 h-52 shrink-0 flex items-center justify-center">
        {/* Animated ambient cyber aura glow */}
        <div 
          className="absolute inset-2 rounded-full blur-2xl opacity-20 dark:opacity-30 transition-all duration-700 pointer-events-none"
          style={{
            backgroundColor: activeItem ? activeItem.color : type === "income" ? "#10b981" : "#6366f1",
          }}
        />

        <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90 select-none relative z-10 overflow-visible">
          {/* SVG Definitions for 3D Cyber Gradients & Glow Filters */}
          <defs>
            <filter id="hud-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {data.map((item, idx) => {
              const gradId = `slice-grad-${idx}`;
              return (
                <linearGradient key={idx} id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={item.color} stopOpacity={1} />
                  <stop offset="60%" stopColor={item.color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0.65} />
                </linearGradient>
              );
            })}
          </defs>

          {/* Futuristic Slow Spinning Outer Starburst HUD Ring */}
          <motion.g
            style={{ transformOrigin: "80px 80px" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          >
            <circle
              cx="80"
              cy="80"
              r="72"
              fill="none"
              stroke="rgba(99, 102, 241, 0.2)"
              strokeWidth="1"
              strokeDasharray="4 8 2 6"
              className="pointer-events-none"
            />
            <circle
              cx="80"
              cy="80"
              r="75"
              fill="none"
              stroke="rgba(148, 163, 184, 0.12)"
              strokeWidth="0.5"
              strokeDasharray="1 5"
              className="pointer-events-none"
            />
          </motion.g>

          {/* Micro Orbit Track Ring (Inner Core) */}
          <motion.g
            style={{ transformOrigin: "80px 80px" }}
            animate={{ rotate: -360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <circle
              cx="80"
              cy="80"
              r="28"
              fill="none"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="1"
              strokeDasharray="3 4"
              className="pointer-events-none"
            />
          </motion.g>

          {/* Centered Slices rendering inside translated SVG Group */}
          <g transform="translate(80, 80)">
            {arcs.map((arc, idx) => {
              const isHovered = hoveredIndex === idx;
              
              const innerRadius = isHovered ? 30 : 36;
              const outerRadius = isHovered ? 68 : 60;
              
              const arcPath = d3.arc<any, any>()({
                innerRadius,
                outerRadius,
                startAngle: arc.startAngle,
                endAngle: arc.endAngle,
                padAngle: 0.035,
                cornerRadius: 6,
              }) || "";

              return (
                <g key={idx} className="cursor-pointer">
                  {/* Visual underlay shadow slice */}
                  {isHovered && (
                    <path
                      d={arcPath}
                      fill={arc.data.color}
                      opacity="0.35"
                      className="origin-center"
                      style={{
                        transform: "scale(1.08)",
                        filter: `blur(6px)`,
                      }}
                    />
                  )}
                  
                  {/* Main Render Slice Segment with Motion Entrance */}
                  <motion.path
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: isHovered ? 1.05 : 1, 
                      opacity: hoveredIndex === null || isHovered ? 1 : 0.45 
                    }}
                    transition={{
                      scale: { type: "spring", stiffness: 350, damping: 20 },
                      opacity: { duration: 0.2 },
                      default: { duration: 0.5, delay: idx * 0.05 }
                    }}
                    d={arcPath}
                    fill={`url(#slice-grad-${idx})`}
                    stroke={isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.15)"}
                    strokeWidth={isHovered ? 2 : 0.5}
                    className="transition-all duration-300 ease-out origin-center"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      filter: isHovered 
                        ? `drop-shadow(0px 8px 20px ${arc.data.color}80) brightness(1.2)` 
                        : `drop-shadow(0px 2px 4px ${arc.data.color}25)`,
                    }}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Dynamic HUD Informative Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center z-20">
          <AnimatePresence mode="wait">
            {activeItem ? (
              <motion.div 
                key={`hud-active-${activeItem.label}`}
                initial={{ opacity: 0, scale: 0.8, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -5 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="space-y-0.5 max-w-full"
              >
                <span 
                  className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full inline-block truncate max-w-[120px] shadow-sm border border-white/20 backdrop-blur-xs"
                  style={{ backgroundColor: `${activeItem.color}25`, color: activeItem.color }}
                >
                  {activeItem.label}
                </span>
                <span className="text-base font-black text-slate-900 dark:text-slate-50 font-mono block leading-none pt-1 tracking-tight">
                  {format(activeItem.value)}
                </span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 block leading-none flex items-center justify-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-amber-500 animate-pulse inline" /> %{activePercent} pay
                </span>
              </motion.div>
            ) : (
              <motion.div 
                key="hud-default"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-0.5"
              >
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest block">
                  {type === "income" ? "TOPLAM GELİR" : "TOPLAM GİDER"}
                </span>
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono block leading-none tracking-tight">
                  {format(total)}
                </span>
                <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 block">
                  {data.length} {type === "income" ? "Gelir Kalemi" : "Kategori Dağılımı"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Proportional Staggered Progress Legend Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 w-full relative z-10">
        {data.map((item, idx) => {
          const isHovered = hoveredIndex === idx;
          const displayPercentage = ((item.value / total) * 100).toFixed(0);

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className={`p-2.5 rounded-2xl transition-all duration-300 border cursor-pointer ${
                isHovered 
                  ? "bg-white dark:bg-slate-800 scale-[1.03] shadow-lg border-indigo-500/40 dark:border-indigo-400/40" 
                  : "bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-850"
              }`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                boxShadow: isHovered ? `0 8px 24px ${item.color}20` : "none"
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span 
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ${isHovered ? "scale-125 ring-2 ring-white/50" : ""}`} 
                    style={{ 
                      backgroundColor: item.color,
                      boxShadow: isHovered ? `0 0 10px ${item.color}` : `0 0 4px ${item.color}60`
                    }} 
                  />
                  <span className={`text-xs truncate transition-all duration-300 ${
                    isHovered 
                      ? "font-black text-slate-900 dark:text-white" 
                      : "text-slate-800 dark:text-slate-200 font-bold"
                  }`}>
                    {item.label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-mono font-black transition-all duration-300 ${
                    isHovered ? "text-indigo-600 dark:text-indigo-400 scale-105 inline-block" : "text-slate-900 dark:text-slate-100"
                  }`}>
                    {format(item.value)}
                  </span>
                </div>
              </div>

              {/* High-Tech Glowing Progress Bar Track */}
              <div className="w-full bg-slate-200/70 dark:bg-slate-800/80 h-2 rounded-full overflow-hidden relative shadow-inner">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, Number(displayPercentage)))}%` }}
                  transition={{ duration: 0.85, ease: "easeOut", delay: idx * 0.05 }}
                  className="h-full rounded-full transition-colors relative overflow-hidden"
                  style={{ 
                    backgroundColor: item.color,
                    boxShadow: `0 0 8px ${item.color}80`
                  }}
                >
                  {/* Subtle animated scan shine line inside bar */}
                  <motion.div
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "linear", delay: idx * 0.2 }}
                    className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  />
                </motion.div>
              </div>

              <div className="flex items-center justify-between mt-1 text-[8.5px] font-black text-slate-500 dark:text-slate-400 font-mono">
                <span>PAY ORANI</span>
                <span className="font-extrabold px-1.5 py-0.2 rounded-md" style={{ color: item.color, backgroundColor: `${item.color}15` }}>
                  %{displayPercentage}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

interface BarChartProps {
  data: { label: string; value: number; color: string }[];
}

export const BarChart: React.FC<BarChartProps> = ({ data }) => {
  const { format } = useCurrency();
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 100);

  return (
    <div className="flex flex-col gap-3 w-full p-1">
      {data.map((item, idx) => {
        const percentage = Math.min((Math.abs(item.value) / maxVal) * 100, 100);
        return (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.08, ease: "easeOut" }}
            className="flex flex-col gap-1.5 w-full group p-2 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-800/80 border border-slate-200/40 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 hover:shadow-md"
          >
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}60` }}
                />
                <span className="font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
              </div>
              <span className="font-black text-slate-900 dark:text-slate-50 font-mono tracking-tight text-xs sm:text-sm">
                {item.value < 0 ? "-" : ""}{format(Math.abs(item.value))}
              </span>
            </div>

            {/* Glowing segmented tech bar track */}
            <div className="w-full bg-slate-200/60 dark:bg-slate-800/80 h-4 rounded-xl overflow-hidden relative shadow-inner p-0.5 flex items-center">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.9, delay: idx * 0.1, ease: "easeOut" }}
                className="h-full rounded-lg relative overflow-hidden flex items-center justify-end pr-1.5"
                style={{
                  background: `linear-gradient(90deg, ${item.color}80, ${item.color})`,
                  boxShadow: `0 0 10px ${item.color}70`
                }}
              >
                {/* Tech bar shimmer effect */}
                <motion.div
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear", delay: idx * 0.3 }}
                  className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                />
                {percentage > 18 && (
                  <span className="text-[9px] font-black text-white font-mono drop-shadow-sm select-none">
                    %{percentage.toFixed(0)}
                  </span>
                )}
              </motion.div>
            </div>
          </motion.div>
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxVal = Math.max(...values, 100);
  const minVal = Math.min(...values, 0);
  const spread = maxVal - minVal || 1;

  // Viewbox Dimensions
  const w = 440;
  const h = 190;
  const padding = 30;

  const points = values.map((val, idx) => {
    const x = padding + (idx / (values.length - 1 || 1)) * (w - padding * 2);
    const y = h - padding - ((val - minVal) / spread) * (h - padding * 2);
    return { x, y, val, label: labels[idx] || "" };
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

  const gradId = `line-area-grad-${lineColor.replace('#', '')}`;
  const glowFilterId = `line-glow-${lineColor.replace('#', '')}`;

  return (
    <div className="w-full p-1 relative">
      {/* Dynamic Hover HUD Badge */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-500 tracking-wider">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>TREND AKIŞ GRAFİĞİ</span>
        </div>
        {hoveredIndex !== null && points[hoveredIndex] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 bg-slate-900 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-md border border-slate-700 font-mono"
          >
            <span className="text-slate-300">{points[hoveredIndex].label}:</span>
            <span className="text-emerald-400 font-black">{format(points[hoveredIndex].val)}</span>
          </motion.div>
        )}
      </div>

      <div className="relative bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl p-2 border border-slate-200/50 dark:border-slate-800/60 overflow-hidden">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible select-none">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.45" />
              <stop offset="70%" stopColor={lineColor} stopOpacity="0.1" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
            </linearGradient>

            <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Cyber Grid Background lines */}
          <line x1={padding} y1={h - padding} x2={w - padding} y2={h - padding} stroke="#64748b" strokeWidth="1" className="opacity-20 dark:opacity-20" />
          <line x1={padding} y1={(h - padding + padding) / 2} x2={w - padding} y2={(h - padding + padding) / 2} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" className="opacity-15 dark:opacity-15" />
          <line x1={padding} y1={padding} x2={w - padding} y2={padding} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" className="opacity-15 dark:opacity-15" />

          {/* Corner tick marks */}
          <path d={`M ${padding} ${padding + 6} L ${padding} ${padding} L ${padding + 6} ${padding}`} fill="none" stroke="#6366f1" strokeWidth="1.5" opacity="0.4" />
          <path d={`M ${w - padding - 6} ${padding} L ${w - padding} ${padding} L ${w - padding} ${padding + 6}`} fill="none" stroke="#6366f1" strokeWidth="1.5" opacity="0.4" />

          {/* Filled Area under line */}
          {points.length > 1 && (
            <motion.path 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              d={areaPath} 
              fill={`url(#${gradId})`} 
            />
          )}

          {/* Stroke Line with Neon Glow */}
          {points.length > 1 && (
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              filter={`url(#${glowFilterId})`}
            />
          )}

          {/* Interactive Hover Indicator Line */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <line
              x1={points[hoveredIndex].x}
              y1={padding}
              x2={points[hoveredIndex].x}
              y2={h - padding}
              stroke={lineColor}
              strokeWidth="1.5"
              strokeDasharray="3 3"
              className="opacity-70 animate-pulse"
            />
          )}

          {/* Dots over coordinates */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <g 
                key={idx} 
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Outer halo */}
                <motion.circle
                  initial={{ scale: 0 }}
                  animate={{ scale: isHovered ? 1.4 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 7 : 4.5}
                  fill="#ffffff"
                  stroke={lineColor}
                  strokeWidth={isHovered ? 3.5 : 2.5}
                  style={{
                    filter: `drop-shadow(0 0 ${isHovered ? "8px" : "4px"} ${lineColor})`
                  }}
                />
                
                {/* Value tooltip label on hover or endpoint */}
                {(isHovered || idx === points.length - 1 || idx === 0) && (
                  <text
                    x={pt.x}
                    y={pt.y - 10}
                    textAnchor="middle"
                    className={`text-[9.5px] font-black font-mono transition-all duration-200 ${
                      isHovered ? "fill-indigo-600 dark:fill-indigo-400 scale-110" : "fill-slate-600 dark:fill-slate-300"
                    }`}
                  >
                    {format(values[idx])}
                  </text>
                )}

                {/* Touch target overlay */}
                <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" />
              </g>
            );
          })}

          {/* Labels below */}
          {labels.map((lbl, idx) => {
            const x = padding + (idx / (labels.length - 1 || 1)) * (w - padding * 2);
            const isHovered = hoveredIndex === idx;
            return (
              <text
                key={idx}
                x={x}
                y={h - 10}
                textAnchor="middle"
                className={`text-[10px] font-black transition-colors duration-200 ${
                  isHovered ? "fill-indigo-600 dark:fill-indigo-400 font-extrabold" : "fill-slate-500 dark:fill-slate-400"
                }`}
              >
                {lbl}
              </text>
            );
          })}
        </svg>
      </div>
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
      <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 font-bold bg-slate-50/20 dark:bg-slate-800/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
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

  const activeDebts = installmentDebts.filter(d => d.paidInstallmentCount < d.installmentCount);
  const debtsToPlot = activeDebts.length > 0 
    ? [...activeDebts].sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5) 
    : [...installmentDebts].slice(0, 5);

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

  const curveW = 340;
  const curveH = 120;
  const padX = 25;
  const padY = 15;

  const svgCoordinates = curvePoints.map((pt, i) => {
    const x = padX + (i / 11) * (curveW - 2 * padX);
    const y = curveH - padY - (pt.value / maxVal) * (curveH - 2 * padY);
    return { x, y, pt };
  });

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

  const activeHoveredDebt = hoveredRingIndex !== null ? debtsToPlot[hoveredRingIndex] : null;

  return (
    <div className="bg-slate-900/95 dark:bg-slate-950 text-white rounded-3xl p-5 shadow-2xl border border-indigo-500/20 space-y-5 relative overflow-hidden backdrop-blur-md">
      {/* Absolute futuristic decorative radial grids in background */}
      <div className="absolute -right-16 -top-16 w-52 h-52 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -left-16 -bottom-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 relative z-10">
        <div>
          <h3 className="text-xs sm:text-sm font-black uppercase text-indigo-400 tracking-widest flex items-center gap-2 leading-none">
            <Zap className="w-4 h-4 text-amber-400 animate-pulse" /> TAKSİT ZAMAN MAKİNESİ
          </h3>
          <p className="text-[10px] sm:text-[11px] text-slate-300 mt-1 font-medium">
            Gelecekteki taksit ödemelerinizi ve borç erime sürecinizi interaktif olarak simüle edin
          </p>
        </div>

        {/* Time machine controller slider tabs */}
        <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl self-start md:self-auto shadow-inner border border-slate-700/60">
          {[0, 1, 3, 6, 12].map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonthOffset(m)}
              className={`px-2.5 py-1 text-[9.5px] font-black tracking-wider uppercase rounded-lg transition-all cursor-pointer ${
                selectedMonthOffset === m
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m === 0 ? "Şimdi" : `+${m} Ay`}
            </button>
          ))}
        </div>
      </div>

      {/* Toplam ve Kalan Taksitli Borç Göstergeleri */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 relative z-10">
        <motion.div 
          whileHover={{ y: -2, scale: 1.01 }}
          className="p-3.5 sm:p-4 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 border border-indigo-500/30 text-white rounded-2xl shadow-lg flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[9.5px] sm:text-[10px] text-indigo-100 font-bold uppercase tracking-wide block leading-none">
              TOPLAM TAKSİTLİ BORÇ
            </span>
            <span className="text-base sm:text-lg font-black font-mono tracking-tight text-white block">
              {format(totalOriginalDebt)}
            </span>
          </div>
          <div className="p-2.5 bg-white/15 rounded-xl text-white text-lg">💳</div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2, scale: 1.01 }}
          className="p-3.5 sm:p-4 bg-gradient-to-br from-rose-600 via-rose-700 to-red-900 border border-rose-500/30 text-white rounded-2xl shadow-lg flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[9.5px] sm:text-[10px] text-rose-100 font-bold uppercase tracking-wide block leading-none">
              KALAN TAKSİTLİ BORÇ
            </span>
            <span className="text-base sm:text-lg font-black font-mono tracking-tight text-white block">
              {format(simulatedRemainingTotal)}
            </span>
          </div>
          <div className="p-2.5 bg-white/15 rounded-xl text-white text-lg">⏳</div>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-12 items-center relative z-10">
        {/* Left Column: Concentric Portal Interactive Orbit */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-44 h-44 shrink-0">
            <svg viewBox="0 0 160 160" className="w-full h-full select-none transform -rotate-90">
              <defs>
                <filter id="neon-tracer" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Outer boundary security decorative ring */}
              <circle cx="80" cy="80" r="76" fill="none" stroke="#334155" strokeWidth="0.75" strokeDasharray="3, 3" className="opacity-40" />

              {/* Loop and draw nested colorful tracks for each installment */}
              {debtsToPlot.map((inst, idx) => {
                const r = 28 + idx * 9.5;
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
                      cx="80"
                      cy="80"
                      r={r}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth={isHovered ? 6 : 4}
                      className="transition-all duration-200 opacity-60"
                    />

                    {/* Animated Filled Progress arc */}
                    <motion.circle
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: strokeOffset }}
                      transition={{ duration: 1, ease: "easeOut", delay: idx * 0.1 }}
                      cx="80"
                      cy="80"
                      r={r}
                      fill="none"
                      stroke={color}
                      strokeWidth={isHovered ? 8 : 5}
                      strokeDasharray={circumference}
                      strokeLinecap="round"
                      style={{
                        filter: isHovered ? `drop-shadow(0 0 8px ${color})` : `drop-shadow(0 0 3px ${color}60)`,
                      }}
                    />

                    {/* Orbit Head Spark Particle */}
                    {progressPercentage > 0 && progressPercentage < 100 && (
                      <circle
                        cx={80 + r * Math.cos((progressPercentage / 100) * 2 * Math.PI)}
                        cy={80 + r * Math.sin((progressPercentage / 100) * 2 * Math.PI)}
                        r="3.5"
                        fill="#ffffff"
                        style={{
                          filter: `drop-shadow(0px 0px 6px ${color})`,
                          opacity: isHovered ? 1 : 0.8
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
                  <span className="text-[9px] font-black uppercase text-slate-300 block tracking-wider leading-none">
                    SEÇİLEN
                  </span>
                  <span 
                    className="text-[11px] font-black truncate max-w-[110px] block"
                    style={{ color: ringColors[debtsToPlot.indexOf(activeHoveredDebt) % ringColors.length] }}
                  >
                    {activeHoveredDebt.name}
                  </span>
                  <span className="text-[12px] font-black font-mono block leading-none text-white pt-0.5">
                    {format(activeHoveredDebt.totalAmount / activeHoveredDebt.installmentCount)}/ay
                  </span>
                  <span className="text-[9px] font-extrabold text-slate-300 block leading-none">
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
                      <span className="text-xs sm:text-sm text-rose-400 font-black font-mono block animate-pulse">
                        {format(simulatedRemainingTotal)}
                      </span>
                      <span className="text-[8.5px] font-extrabold text-slate-300 block leading-none">
                        Azalma: %{currentRemainingTotal > 0 ? (((currentRemainingTotal - simulatedRemainingTotal) / currentRemainingTotal) * 100).toFixed(0) : 0}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[9px] font-black text-indigo-400 block tracking-wider uppercase leading-none">
                        ŞİMDİKİ DURUM
                      </span>
                      <span className="text-xs sm:text-sm text-indigo-200 font-black font-mono block">
                        {format(currentRemainingTotal)}
                      </span>
                      <span className="text-[8.5px] font-extrabold text-slate-300 block leading-none">
                        Kalan Toplam
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="text-[9.5px] text-slate-300 font-bold tracking-wide mt-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400 animate-spin" /> İnteraktif halkalara dokunun
          </div>
        </div>

        {/* Right Column: Beautiful Repayment Wave Slope & Stats breakdown */}
        <div className="md:col-span-7 space-y-4">
          <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex items-center justify-between gap-2 shadow-md">
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
          <div className="relative p-3 bg-slate-950/80 border border-slate-800/90 rounded-2xl shadow-inner">
            <div className="flex items-center justify-between text-[10px] font-black text-indigo-400 uppercase pb-2 px-1">
              <span>📉 Taksit Borç Erime Eğrisi (12 Ay)</span>
              {hoveredPointIndex !== null && (
                <span className="text-emerald-400 normal-case font-bold animate-fade-in font-mono">
                  {curvePoints[hoveredPointIndex].label}: {format(curvePoints[hoveredPointIndex].value)}
                </span>
              )}
            </div>

            <svg viewBox={`0 0 ${curveW} ${curveH}`} className="w-full h-auto">
              <defs>
                <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              <line x1={padX} y1={curveH - padY} x2={curveW - padX} y2={curveH - padY} stroke="#1e293b" strokeWidth="1" />
              <line x1={padX} y1={padY} x2={curveW - padX} y2={padY} stroke="#1e293b" strokeWidth="1" strokeDasharray="2, 2" />

              {/* Gradient filled area */}
              {curvePoints.length > 1 && (
                <motion.path 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1 }}
                  d={gradientPathString} 
                  fill="url(#waveFill)" 
                  className="pointer-events-none" 
                />
              )}

              {/* Glowing Line */}
              {curvePoints.length > 1 && (
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  d={pathString}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="pointer-events-none"
                  style={{ filter: "drop-shadow(0 0 6px #6366f1)" }}
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
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={isSelected ? 5 : isPointHovered ? 4.5 : 2.5}
                      fill={isSelected ? "#10b981" : isPointHovered ? "#6366f1" : "#475569"}
                      stroke="#0f172a"
                      strokeWidth={isSelected || isPointHovered ? 2 : 0}
                      className="transition-all duration-150"
                      style={{ filter: isSelected ? "drop-shadow(0 0 6px #10b981)" : "none" }}
                    />

                    {/* Labels at standard interval points for clean readability */}
                    {(i === 0 || i === 3 || i === 6 || i === 9 || i === 11) && (
                      <text
                        x={coord.x}
                        y={curveH - 4}
                        textAnchor="middle"
                        className="text-[8.5px] fill-slate-300 font-extrabold"
                      >
                        {coord.pt.label}
                      </text>
                    )}

                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r="14"
                      fill="transparent"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Color Indicators Legend Lists */}
          <div className="grid grid-cols-2 gap-1.5 max-h-[90px] overflow-y-auto pr-1">
            {debtsToPlot.map((inst, idx) => {
              const color = ringColors[idx % ringColors.length];
              const isHovered = hoveredRingIndex === idx;
              return (
                <div
                  key={inst.id}
                  className={`flex items-center gap-2 p-1.5 rounded-xl transition-all duration-150 cursor-pointer ${
                    isHovered ? "bg-slate-800 shadow-md" : "hover:bg-slate-850"
                  }`}
                  onMouseEnter={() => setHoveredRingIndex(idx)}
                  onMouseLeave={() => setHoveredRingIndex(null)}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
                  <span className="text-[10.5px] font-bold truncate flex-1 text-slate-200">
                    {inst.name}
                  </span>
                  <span className="text-[9.5px] font-black font-mono text-slate-300 shrink-0">
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


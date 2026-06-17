/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Debt, InstallmentDebt } from "../types";
import { useCurrency } from "../utils/CurrencyContext";

interface DebtTimelineChartProps {
  debts: Debt[];
  installmentDebts: InstallmentDebt[];
  strategy: "snowball" | "avalanche";
  totalIncome: number;
}

export const DebtTimelineChart: React.FC<DebtTimelineChartProps> = ({
  debts,
  installmentDebts,
  strategy,
  totalIncome,
}) => {
  const { format } = useCurrency();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    month: number;
    remaining: number;
    x: number;
    y: number;
  } | null>(null);

  // 1. Run Strategy Simulation
  const unpaidDirect = debts
    .filter((d) => d.amount > d.paid)
    .map((d) => ({
      id: d.id,
      name: d.name,
      remaining: d.amount - d.paid,
      monthlyMin: Math.max(150, (d.amount - d.paid) * 0.05), // Minimum monthly repayment (5% or 150 TL)
    }));

  const unpaidInstallment = installmentDebts
    .filter((inst) => inst.installmentCount > inst.paidInstallmentCount)
    .map((inst) => {
      const monthly = inst.totalAmount / inst.installmentCount;
      const remaining = inst.totalAmount - inst.paidInstallmentCount * monthly;
      return {
        id: inst.id,
        name: inst.name,
        remaining: remaining,
        monthlyMin: monthly,
      };
    });

  const allActiveDebts = [...unpaidDirect, ...unpaidInstallment];
  const initialTotalRemaining = allActiveDebts.reduce((sum, d) => sum + d.remaining, 0);

  // Calculate monthly repayment capacity (based on income and minimum payments)
  const sumMinMonthly = allActiveDebts.reduce((sum, d) => sum + d.monthlyMin, 0);
  const incomeVal = totalIncome || 0;
  // Allocation budget: sum of minimums + 20% of income OR a buffer, with a fallback minimum of 1500 TL
  const monthlyPaymentCapacity = Math.max(
    sumMinMonthly + 250,
    incomeVal * 0.25,
    1500
  );

  const simulationData: Array<{ month: number; remaining: number }> = [];
  
  // Month 0
  simulationData.push({ month: 0, remaining: initialTotalRemaining });

  if (initialTotalRemaining > 0) {
    let currentDebts = allActiveDebts.map((d) => ({ ...d }));
    
    for (let m = 1; m <= 36; m++) {
      const totalLeft = currentDebts.reduce((sum, d) => sum + d.remaining, 0);
      if (totalLeft <= 0) break;

      let availablePool = monthlyPaymentCapacity;

      // Pay the minimum weights of each active debt first
      currentDebts.forEach((d) => {
        if (d.remaining <= 0) return;
        const payment = Math.min(d.remaining, d.monthlyMin, availablePool);
        d.remaining -= payment;
        availablePool -= payment;
      });

      // Extra strategy-based payoff allocation
      if (availablePool > 0) {
        if (strategy === "snowball") {
          // Snowball strategy: sort ascending by overall remaining debt balance
          currentDebts.sort((a, b) => {
            if (a.remaining <= 0) return 1;
            if (b.remaining <= 0) return -1;
            return a.remaining - b.remaining;
          });
        } else {
          // Avalanche strategy: sort descending by overall remaining debt balance
          currentDebts.sort((a, b) => {
            if (a.remaining <= 0) return 1;
            if (b.remaining <= 0) return -1;
            return b.remaining - a.remaining;
          });
        }

        for (const d of currentDebts) {
          if (d.remaining <= 0) continue;
          if (availablePool <= 0) break;
          const extraPayment = Math.min(d.remaining, availablePool);
          d.remaining -= extraPayment;
          availablePool -= extraPayment;
        }
      }

      const endOfMonthRemaining = currentDebts.reduce((sum, d) => sum + d.remaining, 0);
      simulationData.push({ month: m, remaining: Math.round(endOfMonthRemaining) });

      if (endOfMonthRemaining <= 0) {
        break;
      }
    }
  }

  // Ensure we always have at least 2 points to draw
  if (simulationData.length === 1) {
    simulationData.push({ month: 1, remaining: 0 });
  }

  // 2. Responsive D3 Drawing Hook
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Remove any old elements inside the svg
    d3.select(svgRef.current).selectAll("*").remove();

    const containerWidth = containerRef.current.clientWidth || 500;
    const height = 180;
    const margin = { top: 15, right: 20, bottom: 25, left: 55 };
    const width = containerWidth;

    const svg = d3
      .select(svgRef.current)
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("overflow", "visible");

    // X Scale
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(simulationData, (d) => d.month) || 12])
      .range([margin.left, width - margin.right]);

    // Y Scale
    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(simulationData, (d) => d.remaining) || 1000])
      .range([height - margin.bottom, margin.top]);

    // Add X Grid Lines
    svg
      .append("g")
      .attr("class", "grid-axis opacity-10")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickSize(-height + margin.top + margin.bottom)
          .tickFormat(() => "")
      );

    // Add Y Grid Lines
    svg
      .append("g")
      .attr("class", "grid-axis opacity-10")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickSize(-width + margin.left + margin.right)
          .tickFormat(() => "")
      );

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .attr("class", "text-[10px] font-bold text-slate-400 dark:text-slate-500")
      .call(
        d3
          .axisBottom(xScale)
          .ticks(Math.min(10, simulationData.length))
          .tickFormat((d) => `${d}. Ay`)
      )
      .selectAll(".domain, .tick line")
      .attr("stroke", "currentColor")
      .attr("opacity", 0.3);

    // Y Axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .attr("class", "text-[9px] font-medium text-slate-400 dark:text-slate-500")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickFormat((d) => {
            const val = d as number;
            if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
            return val.toString();
          })
      )
      .selectAll(".domain, .tick line")
      .attr("stroke", "currentColor")
      .attr("opacity", 0.3);

    // Strategy Color Theme Setup
    const strategyColor = strategy === "snowball" ? "#3b82f6" : "#f59e0b";
    
    // Add Gradients
    const gradientId = `area-gradient-${strategy}`;
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", strategyColor)
      .attr("stop-opacity", 0.25);

    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", strategyColor)
      .attr("stop-opacity", 0.01);

    // Area Generator
    const areaGenerator = d3
      .area<{ month: number; remaining: number }>()
      .x((d) => xScale(d.month))
      .y0(height - margin.bottom)
      .y1((d) => yScale(d.remaining))
      .curve(d3.curveMonotoneX);

    // Line Generator
    const lineGenerator = d3
      .line<{ month: number; remaining: number }>()
      .x((d) => xScale(d.month))
      .y((d) => yScale(d.remaining))
      .curve(d3.curveMonotoneX);

    // Draw Area under curve with animation
    const areaPath = svg
      .append("path")
      .datum(simulationData)
      .attr("fill", `url(#${gradientId})`)
      .attr("d", areaGenerator);

    // Draw Line with path animation
    const linePath = svg
      .append("path")
      .datum(simulationData)
      .attr("fill", "none")
      .attr("stroke", strategyColor)
      .attr("stroke-width", 2.5)
      .attr("stroke-linecap", "round")
      .attr("d", lineGenerator);

    const totalLength = linePath.node()?.getTotalLength() || 0;
    linePath
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    // Draw interactive invisible rect over SVG for triggering dynamic tooltips
    const pointerOverlay = svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .attr("pointer-events", "all");

    // Add interactive vertical hover line
    const hoverLine = svg
      .append("line")
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#64748b")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .style("opacity", 0)
      .attr("pointer-events", "none");

    // Add highlighted active indicator circle on chart curve
    const hoverDot = svg
      .append("circle")
      .attr("r", 5)
      .attr("fill", strategyColor)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("opacity", 0)
      .attr("pointer-events", "none");

    const bisectMonth = d3.bisector<{ month: number; remaining: number }, number>((d) => d.month).left;

    pointerOverlay.on("mousemove", (event) => {
      const [xPos] = d3.pointer(event);
      const mVal = xScale.invert(xPos);
      const index = bisectMonth(simulationData, mVal, 0, simulationData.length - 1);
      
      let selectedPoint = simulationData[index];
      if (index > 0) {
        const prevPoint = simulationData[index - 1];
        if (mVal - prevPoint.month < selectedPoint.month - mVal) {
          selectedPoint = prevPoint;
        }
      }

      if (selectedPoint) {
        const hoverX = xScale(selectedPoint.month);
        const hoverY = yScale(selectedPoint.remaining);

        hoverLine.attr("x1", hoverX).attr("x2", hoverX).style("opacity", 1);
        hoverDot.attr("cx", hoverX).attr("cy", hoverY).style("opacity", 1);

        setHoveredPoint({
          month: selectedPoint.month,
          remaining: selectedPoint.remaining,
          x: hoverX,
          y: hoverY,
        });
      }
    });

    pointerOverlay.on("mouseleave", () => {
      hoverLine.style("opacity", 0);
      hoverDot.style("opacity", 0);
      setHoveredPoint(null);
    });

    // Resize observer handling to ensure chart is robustly fluid on all viewports
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const targetWidth = containerRef.current.clientWidth;
      if (targetWidth !== containerWidth) {
        // Redraw
        d3.select(svgRef.current).style("width", `${targetWidth}px`);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [debts, installmentDebts, strategy, totalIncome, simulationData.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        <span>📉 BORÇ AZALIM ZAMAN ÇİZGİSİ PROJEKSİYONU</span>
        <span className="text-right text-[10px] text-slate-500 font-semibold lowercase">
          {strategy === "snowball" ? "küçük borç başlar" : "büyük borç başlar"} • kapasite: {format(monthlyPaymentCapacity)}/ay
        </span>
      </div>

      <div ref={containerRef} className="relative w-full overflow-visible p-2 bg-slate-100/30 dark:bg-slate-900/10 rounded-2xl border border-slate-200/20 dark:border-slate-800/60 shadow-inner">
        <svg ref={svgRef} className="w-full h-[180px] select-none block" />

        {hoveredPoint && (
          <div
            className="absolute z-10 pointer-events-none p-2 bg-slate-900/90 text-[11px] font-sans text-white rounded-xl shadow-lg border border-slate-700/50 backdrop-blur-xs flex flex-col gap-0.5"
            style={{
              left: `${hoveredPoint.x + 8}px`,
              top: `${hoveredPoint.y - 48}px`,
              transform: hoveredPoint.x > (containerRef.current?.clientWidth || 200) - 100 ? "translateX(-110%)" : "none",
            }}
          >
            <span className="font-semibold text-slate-300">
              {hoveredPoint.month === 0 ? "Başlangıç" : `${hoveredPoint.month}. Ay Sonu`}
            </span>
            <span className="font-extrabold text-indigo-300 font-mono text-xs">
              Kalan: {format(hoveredPoint.remaining)}
            </span>
          </div>
        )}
      </div>

      <span className="text-[9px] text-slate-400 dark:text-slate-500 block text-center font-bold">
        💡 Bu simülasyon, aylık asgari borç ödemelerinden sonra kalan bütçenin seçtiğiniz stratejiye göre en üstteki borca yatırılması prensibiyle hesaplanmıştır.
      </span>
    </div>
  );
};

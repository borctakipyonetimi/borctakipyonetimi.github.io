/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  maxHeight?: string | number;
  className?: string;
  containerClassName?: string;
  getItemKey?: (item: T, index: number) => string | number;
  emptyContent?: React.ReactNode;
  /**
   * If items count is below threshold, render standard list to avoid virtualization overhead
   * Defaults to 4.
   */
  threshold?: number;
  /**
   * Responsive columns count (1 or 2). If 2, items are chunked in pairs.
   */
  columns?: 1 | 2;
  id?: string;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 140,
  overscan = 4,
  maxHeight = "640px",
  className = "",
  containerClassName = "",
  getItemKey,
  emptyContent = null,
  threshold = 4,
  columns = 1,
  id,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // If columns is 2, group items into pairs of [itemA, itemB?]
  const rowItems = useMemo(() => {
    if (columns !== 2) return items.map((item, idx) => ({ items: [item], originalIndices: [idx] }));
    const rows: Array<{ items: T[]; originalIndices: number[] }> = [];
    for (let i = 0; i < items.length; i += 2) {
      if (i + 1 < items.length) {
        rows.push({ items: [items[i], items[i + 1]], originalIndices: [i, i + 1] });
      } else {
        rows.push({ items: [items[i]], originalIndices: [i] });
      }
    }
    return rows;
  }, [items, columns]);

  const virtualizer = useVirtualizer({
    count: rowItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (columns === 2 ? estimateSize * 1.05 : estimateSize),
    overscan,
    getItemKey: (index) => {
      if (getItemKey && rowItems[index]?.items[0]) {
        return getItemKey(rowItems[index].items[0], rowItems[index].originalIndices[0]);
      }
      return index;
    },
  });

  if (!items || items.length === 0) {
    return <>{emptyContent}</>;
  }

  // Small lists optimization: render directly without virtual slicing
  if (items.length <= threshold) {
    if (columns === 2) {
      return (
        <div
          id={id}
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${containerClassName}`}
          style={{
            willChange: "transform",
            transform: "translateZ(0)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {items.map((item, index) => (
            <div key={getItemKey ? getItemKey(item, index) : index} className="w-full">
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div
        id={id}
        className={`space-y-3 ${containerClassName}`}
        style={{
          willChange: "transform",
          transform: "translateZ(0)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((item, index) => (
          <div key={getItemKey ? getItemKey(item, index) : index} className="w-full">
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      id={id}
      className={`overflow-y-auto scroll-smooth pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 ${containerClassName}`}
      style={{
        maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
        willChange: "transform",
        transform: "translateZ(0)",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "auto",
        touchAction: "pan-y",
      }}
    >
      <div
        className={`w-full relative ${className}`}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
          willChange: "transform",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowData = rowItems[virtualRow.index];
          if (!rowData) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                willChange: "transform",
              }}
              className="pb-3.5"
            >
              {columns === 2 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rowData.items.map((subItem, subIdx) => (
                    <div key={subIdx} className="w-full">
                      {renderItem(subItem, rowData.originalIndices[subIdx])}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full">
                  {renderItem(rowData.items[0], rowData.originalIndices[0])}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

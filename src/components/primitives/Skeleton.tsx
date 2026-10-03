import type { CSSProperties, ReactNode } from "react";
import { Spinner } from "./Spinner";

type SkeletonVariant = "line" | "block" | "avatar" | "pill";
type Size = number | string;

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: Size;
  height?: Size;
  className?: string;
  style?: CSSProperties;
}

function toCss(value: Size | undefined): string | undefined {
  return typeof value === "number" ? `${value}px` : value;
}

export function Skeleton({ variant = "line", width, height, className, style }: SkeletonProps) {
  return (
    <span
      className={["wpn-skeleton", `wpn-skeleton--${variant}`, className].filter(Boolean).join(" ")}
      style={{ width: toCss(width), height: toCss(height), ...style }}
      aria-hidden="true"
    />
  );
}

interface SkeletonLinesProps {
  lines?: number;
  lastWidth?: Size;
  className?: string;
}

export function SkeletonLines({ lines = 3, lastWidth = "55%", className }: SkeletonLinesProps) {
  return (
    <span className={["wpn-skeleton-lines", className].filter(Boolean).join(" ")}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 && lines > 1 ? lastWidth : "100%"} />
      ))}
    </span>
  );
}

interface SkeletonCardProps {
  lines?: number;
  avatar?: boolean;
  minHeight?: Size;
  className?: string;
}

export function SkeletonCard({
  lines = 2,
  avatar = true,
  minHeight,
  className,
}: SkeletonCardProps) {
  return (
    <div
      className={["wpn-skeleton-card", className].filter(Boolean).join(" ")}
      style={{ minHeight: toCss(minHeight) }}
      aria-hidden="true"
    >
      <div className="wpn-skeleton-card__head">
        {avatar ? <Skeleton variant="avatar" /> : null}
        <SkeletonLines lines={2} lastWidth="40%" className="wpn-skeleton-card__title" />
      </div>
      {lines > 0 ? <SkeletonLines lines={lines} /> : null}
    </div>
  );
}

interface SkeletonSlotProps {
  isLoading: boolean;
  showSkeleton: boolean;
  skeleton: ReactNode;
  label?: string;
  minHeight?: Size;
  className?: string;
  children?: ReactNode;
}

export function SkeletonSlot({
  isLoading,
  showSkeleton,
  skeleton,
  label,
  minHeight,
  className,
  children,
}: SkeletonSlotProps) {
  if (showSkeleton) {
    return (
      <div
        className={["wpn-skeleton-slot", className].filter(Boolean).join(" ")}
        role="status"
        aria-busy="true"
        aria-label={label}
        data-wpn-loading="skeleton"
      >
        {skeleton}
      </div>
    );
  }
  if (isLoading) {
    return (
      <div
        className={["wpn-skeleton-slot", className].filter(Boolean).join(" ")}
        style={{ minHeight: toCss(minHeight) }}
        aria-busy="true"
        data-wpn-loading="pending"
      />
    );
  }
  return (
    <div className={["wpn-reveal", className].filter(Boolean).join(" ")} data-wpn-loading="ready">
      {children}
    </div>
  );
}

interface RefreshingIndicatorProps {
  active: boolean;
  label?: string;
}

export function RefreshingIndicator({ active, label = "Updating" }: RefreshingIndicatorProps) {
  return (
    <span
      className={["wpn-refreshing", active ? "wpn-refreshing--on" : ""].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      {active ? (
        <>
          <Spinner />
          {label ? <span className="wpn-refreshing__label">{label}</span> : null}
        </>
      ) : null}
    </span>
  );
}

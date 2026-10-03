import { Skeleton, SkeletonCard } from "../primitives/Skeleton";

export function ConnectorsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="wpn-ai-connectors">
      <Skeleton width="62%" height={12} />
      <div className="wpn-skeleton-grid" style={{ marginTop: 14 }}>
        {Array.from({ length: cards }, (_, index) => (
          <SkeletonCard key={index} lines={3} minHeight={150} />
        ))}
      </div>
    </div>
  );
}

export function IntegrationsSkeleton() {
  return (
    <div className="wpn-ai-settings">
      <div className="wpn-skeleton-subtabs">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <ConnectorsSkeleton />
    </div>
  );
}

export function SessionListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      <li className="wpn-sr-only" role="status">
        Loading chats
      </li>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="wpn-skeleton-session" aria-hidden="true">
          <Skeleton />
          <Skeleton />
        </li>
      ))}
    </>
  );
}

export function TranscriptSkeleton() {
  return (
    <div className="wpn-skeleton-transcript">
      <div className="wpn-skeleton-bubble wpn-skeleton-bubble--user">
        <Skeleton width="90%" />
        <Skeleton width="60%" />
      </div>
      <div className="wpn-skeleton-bubble wpn-skeleton-bubble--agent">
        <Skeleton width="100%" />
        <Skeleton width="94%" />
        <Skeleton width="70%" />
      </div>
      <div className="wpn-skeleton-bubble wpn-skeleton-bubble--user">
        <Skeleton width="80%" />
      </div>
      <div className="wpn-skeleton-bubble wpn-skeleton-bubble--agent">
        <Skeleton width="100%" />
        <Skeleton width="48%" />
      </div>
    </div>
  );
}

export function AnnotationListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="wpn-skeleton-stack" role="status" aria-label="Loading annotations">
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonCard key={index} lines={2} minHeight={104} />
      ))}
    </div>
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="wpn-skeleton-stack">
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonCard key={index} lines={1} avatar={false} />
      ))}
    </div>
  );
}

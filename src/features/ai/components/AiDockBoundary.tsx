import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
  onRetry?: () => void;
}

interface State {
  failed: boolean;
}

export class AiDockBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  private retry = () => {
    this.props.onRetry?.();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="wpn-ai-dock-failed" role="alert">
        <span>{this.props.label ?? "The AI assistant could not load."}</span>
        {this.props.onRetry ? (
          <button type="button" className="wpn-btn" onClick={this.retry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }
}

export function AiDockSkeleton({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="wpn-ai-dock wpn-ai-dock--open wpn-ai-dock--compact wpn-ai-dock--loading"
      role="status"
      aria-label="Loading AI assistant"
    >
      <div className="wpn-ai-dock__composer">
        <span className="wpn-skeleton wpn-ai-dock__skeleton-line" />
        <span className="wpn-skeleton wpn-ai-dock__skeleton-line wpn-ai-dock__skeleton-line--short" />
      </div>
    </div>
  );
}

import { Component, type ErrorInfo, type ReactNode } from "react";

interface PanelErrorBoundaryProps {
  children: ReactNode;
  label?: string;
  onRetry?: () => void;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
}

export class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PanelErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("wec-pinnote-lib panel failed to render", error, info);
  }

  private retry = () => {
    this.props.onRetry?.();
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div className="wpn-root wpn-error-boundary" role="alert">
        <span>{this.props.label ?? "This panel failed to render."}</span>
        {this.props.onRetry ? (
          <button type="button" className="wpn-btn" onClick={this.retry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }
}

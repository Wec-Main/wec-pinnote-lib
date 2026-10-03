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

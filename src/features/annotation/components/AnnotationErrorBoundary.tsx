import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AnnotationErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("wec-pinnote-lib failed to render annotation UI", error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="wpn-root wpn-error-boundary" role="alert">
          Annotation UI failed to render.
        </div>
      );
    }
    return this.props.children;
  }
}

"use client";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ModuleErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Module error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-3">⚠️</div>
            <div className="font-medium text-base mb-2" style={{ color: "var(--bordeaux)" }}>
              Ошибка в модуле
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || "Произошла ошибка при загрузке данных"}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--bordeaux)", color: "var(--cream)" }}
            >
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

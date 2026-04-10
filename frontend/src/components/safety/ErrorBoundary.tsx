// ---------------------------------------------------------------------------
// CMP-ERROR-BOUNDARY-FALLBACK — Generic error fallback UI
// ---------------------------------------------------------------------------

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page" style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: "var(--space-4)" }}>Something went wrong</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
            {this.state.error.message}
          </p>
          <button
            className="btn-secondary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

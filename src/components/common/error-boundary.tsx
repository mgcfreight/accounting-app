import { Component, ReactNode } from "react";
import ErrorState from "./error-state";

type Props = {
  children: ReactNode;
  // Replaces the default ErrorState. A function is given `reset`.
  fallback?: ReactNode | ((reset: () => void) => ReactNode);
  // A caught error clears when this changes — pass the pathname so moving to
  // another page leaves the error behind.
  resetKey?: unknown;
};

// Catches an error thrown while rendering and shows the fallback in place of
// the subtree, so one broken page cannot blank the app — and a page that
// failed part-way never shows half its numbers. React has no hook for this,
// hence a class. React already logs the error to the console.
//
// Render errors only: errors in event handlers and promises are not caught
// here and still need their own handling.
export default class ErrorBoundary extends Component<
  Props,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  reset = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    const { fallback } = this.props;
    if (typeof fallback === "function") return fallback(this.reset);
    return (
      fallback ?? (
        <ErrorState
          message="This page hit an unexpected error. Try again, or open another page."
          actionText="Try again"
          onAction={this.reset}
        />
      )
    );
  }
}

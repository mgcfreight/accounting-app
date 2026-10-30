import { Component, ReactNode } from "react";
import { isChunkLoadError } from "@/lib/chunk-error";
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
//
// A page chunk that failed to download gets "Reload page" instead of "Try
// again": React.lazy keeps the failed import, so re-rendering replays the
// failure, and only a reload fetches the chunk again.
export default class ErrorBoundary extends Component<
  Props,
  { failed: boolean; chunkFailed: boolean }
> {
  state = { failed: false, chunkFailed: false };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, chunkFailed: isChunkLoadError(error) };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false, chunkFailed: false });
    }
  }

  reset = () => this.setState({ failed: false, chunkFailed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    const { fallback } = this.props;
    if (typeof fallback === "function") return fallback(this.reset);
    if (fallback !== undefined) return fallback;
    if (this.state.chunkFailed) {
      return (
        <ErrorState
          title="This page couldn't load"
          message="The app may have just been updated. Reload the page to get the latest version."
          actionText="Reload page"
          onAction={() => window.location.reload()}
        />
      );
    }
    return (
      <ErrorState
        message="This page hit an unexpected error. Try again, or open another page."
        actionText="Try again"
        onAction={this.reset}
      />
    );
  }
}

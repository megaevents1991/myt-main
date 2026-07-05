"use client";

import { Component, ReactNode } from "react";
import Link from "next/link";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class OrderErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Order page error:", error, errorInfo);
    
    // Log to your error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              We&apos;re having trouble loading this event. Please try again.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-main text-white px-6 py-2 rounded-lg hover:bg-secondary transition-colors"
              type="button"
              aria-label="Try loading the page again"
            >
              Try Again
            </button>
            <br />
            <Link
              href="/"
              className="text-main dark:text-foreground hover:underline mt-4 inline-block"
            >
              Return to Home
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

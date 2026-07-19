"use client";

import { Component, ReactNode } from "react";
import { OrderIssueState } from "@/components/ui/OrderIssueState";

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
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <OrderIssueState
            variant="error"
            className="max-w-xl border-0 bg-transparent"
            title="אופס, משהו השתבש אצלנו"
            subtitle="לא הצלחנו לטעון את האירוע. אנחנו על זה — נסו שוב עוד רגע, ואם זה חוזר על עצמו דברו איתנו ונעזור."
            onRetry={() => this.setState({ hasError: false })}
            whatsAppText="היי, ניסיתי לפתוח אירוע באתר וקיבלתי שגיאה. אשמח לעזרה :)"
            showHomeLink
          />
        </div>
      );
    }

    return this.props.children;
  }
}

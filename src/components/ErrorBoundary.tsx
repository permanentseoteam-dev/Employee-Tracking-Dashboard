import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('💥 [ErrorBoundary Caught Error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 32,
            margin: 24,
            backgroundColor: 'var(--bg-card, #0e1526)',
            borderRadius: 12,
            border: '1px solid var(--border-medium, #263353)',
            color: 'var(--text-primary, #f8fafc)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <AlertTriangle size={28} />
          </div>

          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              {this.props.fallbackTitle || 'Component Render Notice'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary, #94a3b8)', maxWidth: 500 }}>
              An error occurred while displaying this section. Telemetry and live sync remain active in the background.
            </p>
          </div>

          {this.state.error && (
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                backgroundColor: 'rgba(0,0,0,0.3)',
                padding: '10px 16px',
                borderRadius: 6,
                color: '#f87171',
                maxWidth: '90%',
                overflowX: 'auto',
                textAlign: 'left',
              }}
            >
              {this.state.error.toString()}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              className="btn btn-primary"
              onClick={this.handleReset}
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} />
              <span>Retry Component</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.location.reload()}
              style={{ padding: '8px 16px' }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

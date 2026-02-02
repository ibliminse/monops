'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showResetConfirm: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showResetConfirm: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleResetData = () => {
    if (typeof window !== 'undefined' && window.indexedDB) {
      window.indexedDB.deleteDatabase('monops');
    }
    this.setState({ hasError: false, error: null, showResetConfirm: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-6">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-white/50 mb-6 text-sm">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={this.handleReload}
                className="bg-purple-500 hover:bg-purple-600 w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              {!this.state.showResetConfirm ? (
                <Button
                  variant="outline"
                  onClick={() => this.setState({ showResetConfirm: true })}
                  className="w-full text-white/50 border-white/10 hover:text-white hover:border-white/20"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Data & Reload
                </Button>
              ) : (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                  <p className="text-red-400 text-sm mb-3">
                    This will delete all locally stored data (holdings, collections, batch history). This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => this.setState({ showResetConfirm: false })}
                      className="flex-1 text-white/50 border-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={this.handleResetData}
                      className="flex-1 bg-red-500 hover:bg-red-600"
                    >
                      Delete & Reload
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

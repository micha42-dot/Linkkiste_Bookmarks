import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 text-gray-800 font-sans">
          <div className="max-w-md w-full bg-white p-6 rounded shadow border border-red-200">
            <h1 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h1>
            <p className="mb-4 text-sm text-gray-600">The application crashed. If you are on an iPhone, this might be a date format issue.</p>
            
            <div className="bg-gray-100 p-4 rounded text-left mb-6 overflow-auto border border-gray-300">
                <code className="text-xs text-red-800 break-all whitespace-pre-wrap">
                    {this.state.error?.toString() || "Unknown Error"}
                </code>
            </div>

            <button 
                onClick={() => window.location.reload()} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
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
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
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
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in ${this.props.moduleName || 'Component'}:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
            Algo salió mal en el módulo {this.props.moduleName ? `"${this.props.moduleName}"` : ''}
          </h2>
          <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-6 text-center max-w-md">
            {this.state.error?.message || 'Error inesperado de la aplicación.'}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
          
          {import.meta.env.DEV && this.state.errorInfo && (
            <details className="mt-6 w-full text-left bg-white/50 dark:bg-black/20 p-4 rounded-lg overflow-auto text-xs text-slate-500">
              <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300 mb-2">
                Detalles técnicos (Stack trace)
              </summary>
              <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

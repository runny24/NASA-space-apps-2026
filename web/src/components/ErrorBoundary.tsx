// The last line of defence: if anything in the app throws while drawing, show what happened and
// how to get going again, instead of React's default of an empty page. A sample site's notice
// stays on screen even then, because a screenshot of the error page must not pass for real data.

import { Component, type ReactNode } from 'react';

/**
 * What the crash page needs to know about the app's state. App.tsx keeps it current whenever the
 * place changes; it lives outside React because React state is gone once the app has crashed.
 */
export const crashContext: { sampleNotice: string | null } = { sampleNotice: null };

export function CrashMessage(props: { message: string; sampleNotice: string | null; href: string; homeHref: string }) {
  return (
    <div className="app">
      <header className="header">
        <h1>Something went wrong</h1>
      </header>
      {props.sampleNotice !== null && (
        <div className="notice" role="note" data-testid="sample-notice">
          <strong>Sample data:</strong> {props.sampleNotice}
        </div>
      )}
      <main className="crash" role="alert" data-testid="crash">
        <p>The map stopped working because of an error in the app:</p>
        <pre>{props.message}</pre>
        <p>
          <a href={props.href}>Reload the page</a>. If the same error comes back,{' '}
          <a href={props.homeHref}>open the map without the settings in this link</a>.
        </p>
      </main>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown): void {
    // Keep the details in the console for whoever is debugging.
    console.error('The app crashed:', error);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <CrashMessage
        message={this.state.error.message}
        sampleNotice={crashContext.sampleNotice}
        href={window.location.href}
        homeHref={window.location.pathname}
      />
    );
  }
}

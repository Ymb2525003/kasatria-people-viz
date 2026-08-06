"use client";

/**
 * Loading / error / empty states.
 *
 * Copy follows one rule: say what happened and what to do next. Errors do not
 * apologise and are never vague; an empty screen is an invitation to act.
 */

export function LoadingState() {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="state__pulse" aria-hidden="true" />
      <p className="state__title">Loading people from the spreadsheet</p>
      <p className="state__body">Reading 200 records.</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <p className="state__title">The data did not load</p>
      <p className="state__body">{message}</p>
      {/* Rendered from a server component on first load, where there is no
          client handler to retry with -- a full reload is the retry. */}
      <button
        type="button"
        className="state__action"
        onClick={onRetry ?? (() => window.location.reload())}
      >
        Try again
      </button>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="state">
      <p className="state__title">The spreadsheet has no readable rows</p>
      <p className="state__body">
        Check that the sheet contains data below the header row and that the
        configured range matches the tab name.
      </p>
    </div>
  );
}

export function NoMatchesState({ query }: { query: string }) {
  return (
    <div className="state state--overlay" role="status" aria-live="polite">
      <p className="state__title">No one matches &ldquo;{query}&rdquo;</p>
      <p className="state__body">Try a country code such as MY, or an interest such as Cooking.</p>
    </div>
  );
}

"use client";

import { signIn } from "next-auth/react";

/**
 * The sign-in gate.
 *
 * Renders the Google mark as inline SVG rather than loading Google's hosted
 * button script: one less third-party request, no layout shift, and full
 * control over focus styles. The wordmark colours are Google's own.
 */
export function SignInScreen() {
  return (
    <main className="signin">
      <div className="signin__panel">
        <p className="signin__eyebrow">Kasatria</p>
        <h1 className="signin__title">200 people, four arrangements</h1>
        <p className="signin__body">
          A live view of the candidate dataset, read directly from Google
          Sheets. Sign in to continue.
        </p>
        <button type="button" className="signin__button" onClick={() => void signIn("google")}>
          <GoogleMark />
          Sign in with Google
        </button>
        <p className="signin__note">
          Only your name and email address are requested.
        </p>
        <p className="signin__note signin__credit">
          Built by{" "}
          <a
            href="https://github.com/Ymb2525003/kasatria-people-viz"
            target="_blank"
            rel="noopener noreferrer"
          >
            Yaseen Ahmed
          </a>
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"/>
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"/>
      <path fill="#FBBC05" d="M11.6 28.2c-.5-1.3-.7-2.8-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.8 17 2 20.4 2 24s.8 7 2.3 9.9l7.3-5.7z"/>
      <path fill="#EA4335" d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z"/>
    </svg>
  );
}

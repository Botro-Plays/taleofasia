'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

export interface ReCaptchaRef {
  execute: () => Promise<string>;
}

interface ReCaptchaProps {
  siteKey: string;
  version?: 'v2' | 'v3';
  action?: string;
  onVerify?: (token: string | null) => void;
}

const ReCaptcha = forwardRef<ReCaptchaRef, ReCaptchaProps>(
  ({ siteKey, version = 'v2', action = 'submit', onVerify }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<number | null>(null);
    const renderedRef = useRef(false);
    const v3ReadyRef = useRef(false);
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
      if (!siteKey) return;

      if (version === 'v3') {
        const v2Script = document.querySelector('script[src*="recaptcha/api.js?render=explicit"]');
        if (v2Script) v2Script.remove();

        const scriptId = 'recaptcha-v3-script';
        if (document.getElementById(scriptId)) return;

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
        script.async = true;
        script.defer = true;
        script.onload = () => { v3ReadyRef.current = true; };
        document.head.appendChild(script);

        return () => {
          const existing = document.getElementById(scriptId);
          if (existing) existing.remove();
          v3ReadyRef.current = false;
        };
      }

      // v2
      const scriptId = 'recaptcha-v2-script';
      let existing = document.getElementById(scriptId) as HTMLScriptElement | null;

      // On retry, remove the old script tag if it failed to load
      if (existing && retryCount > 0) {
        existing.remove();
        existing = null;
        renderedRef.current = false;
        widgetIdRef.current = null;
      }

      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;

      const renderWidget = (retries = 30) => {
        if (cancelled || !containerRef.current) return;
        const grecaptcha = (window as any).grecaptcha;
        if (!grecaptcha?.render) {
          if (retries > 0) {
            retryTimer = setTimeout(() => renderWidget(retries - 1), 300);
            return;
          }
          setLoadState('error');
          return;
        }
        // Use grecaptcha.ready() for reliable initialization
        grecaptcha.ready(() => {
          if (cancelled || !containerRef.current) return;
          if (widgetIdRef.current !== null) {
            try { grecaptcha.reset(widgetIdRef.current); } catch {}
          }
          if (renderedRef.current) return;
          renderedRef.current = true;
          try {
            widgetIdRef.current = grecaptcha.render(containerRef.current, {
              sitekey: siteKey,
              callback: (token: string) => onVerify?.(token),
              'expired-callback': () => onVerify?.(null),
              'error-callback': () => {
                onVerify?.(null);
                setLoadState('error');
              },
            });
            setLoadState('ready');
          } catch {
            setLoadState('error');
          }
        });
      };

      if (existing) {
        renderWidget();
      } else {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://www.google.com/recaptcha/api.js?render=explicit`;
        script.async = true;
        script.defer = true;
        script.onload = () => renderWidget();
        script.onerror = () => {
          if (!cancelled) setLoadState('error');
        };
        document.head.appendChild(script);
      }

      return () => {
        cancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
        if (widgetIdRef.current !== null && (window as any).grecaptcha) {
          try { (window as any).grecaptcha.reset(widgetIdRef.current); } catch {}
          widgetIdRef.current = null;
        }
        renderedRef.current = false;
      };
    }, [siteKey, version, action, onVerify, retryCount]);

    useImperativeHandle(ref, () => ({
      execute: () => new Promise((resolve, reject) => {
        if (version !== 'v3') {
          reject(new Error('execute() is only available for reCAPTCHA v3'));
          return;
        }
        const grecaptcha = (window as any).grecaptcha;
        if (!grecaptcha || !v3ReadyRef.current) {
          reject(new Error('reCAPTCHA v3 not ready'));
          return;
        }
        grecaptcha.ready(() => {
          grecaptcha.execute(siteKey, { action })
            .then(resolve)
            .catch(reject);
        });
      }),
    }));

    if (!siteKey) {
      return (
        <div className="text-sm text-red-400 border border-red-600/40 bg-red-900/20 rounded p-2">
          reCAPTCHA site key is not configured.
        </div>
      );
    }

    if (version === 'v3') return null;

    return (
      <div className="flex flex-col items-center gap-2">
        {loadState === 'loading' && (
          <div className="text-sm text-slate-400 animate-pulse">Loading reCAPTCHA...</div>
        )}
        {loadState === 'error' && (
          <div className="text-sm text-red-400 border border-red-600/40 bg-red-900/20 rounded p-2 flex flex-col items-center gap-2">
            <span>Failed to load reCAPTCHA. Common causes: ad blockers, browser extensions, or network restrictions.</span>
            <button
              type="button"
              onClick={() => {
                setLoadState('loading');
                setRetryCount(c => c + 1);
              }}
              className="text-xs px-3 py-1 rounded border border-red-600/50 hover:bg-red-900/40 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        <div ref={containerRef} />
      </div>
    );
  }
);

ReCaptcha.displayName = 'ReCaptcha';
export default ReCaptcha;

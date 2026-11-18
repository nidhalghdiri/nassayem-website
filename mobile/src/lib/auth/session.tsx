import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { configureApiClient } from '@/lib/api/client';
import { fetchMe, login } from '@/lib/api/endpoints';
import { unregisterForPush } from '@/lib/notifications/push';
import type { MobileUser } from '@/lib/api/schemas';

import { clearStoredSession, loadStoredSession, storeSession, storeUser } from './storage';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: MobileUser };

type SessionContextValue = {
  session: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  /** The user signs out: this phone also stops receiving their notifications. */
  signOut: () => Promise<void>;
  /** Re-fetches the profile (role, buildings) from the server. */
  refreshUser: () => Promise<void>;
  /** Replaces the cached profile, e.g. after the server returned an updated one. */
  setUser: (user: MobileUser) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  // A ref so the API client always reads the current token without re-registering.
  const tokenRef = useRef<string | null>(null);

  // Ends the session locally. Used directly when the server already rejected
  // the token (401) — calling the API again then would only fail.
  const endSession = useCallback(async () => {
    tokenRef.current = null;
    await clearStoredSession();
    queryClient.clear();
    setSession({ status: 'signedOut' });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    // While the token is still valid, so the server accepts the request.
    if (tokenRef.current) await unregisterForPush();
    await endSession();
  }, [endSession]);

  const setUser = useCallback((user: MobileUser) => {
    void storeUser(user);
    setSession({ status: 'signedIn', user });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await fetchMe());
    } catch {
      // A 401 already signed us out (see configureApiClient). Network errors
      // keep the cached profile so the app still opens with weak signal.
    }
  }, [setUser]);

  useEffect(() => {
    configureApiClient({
      getToken: () => tokenRef.current,
      onUnauthorized: () => void endSession(),
    });
  }, [endSession]);

  // Restore the stored session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadStoredSession();
      if (cancelled) return;
      if (!stored) {
        setSession({ status: 'signedOut' });
        return;
      }
      tokenRef.current = stored.token;
      if (stored.user) {
        // Open straight away with the cached profile, then refresh it.
        setSession({ status: 'signedIn', user: stored.user });
        void refreshUser();
        return;
      }
      try {
        setUser(await fetchMe());
      } catch {
        // No cached profile and the server is unreachable or rejected the token.
        if (!cancelled) await endSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser, setUser, endSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await login(email, password);
      tokenRef.current = result.token;
      await storeSession(result.token, result.user);
      setSession({ status: 'signedIn', user: result.user });
    },
    [],
  );

  const value = useMemo(
    () => ({ session, signIn, signOut, refreshUser, setUser }),
    [session, signIn, signOut, refreshUser, setUser],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const context = use(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}

/** The signed-in user. Only call from screens behind the signed-in guard. */
export function useCurrentUser(): MobileUser {
  const { session } = useSession();
  if (session.status !== 'signedIn') throw new Error('useCurrentUser called while signed out');
  return session.user;
}

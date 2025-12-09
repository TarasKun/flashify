"use client";

import { LoaderCircle, LogIn, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createGuestIdentity,
  getSupabaseBrowserClient,
  GUEST_IDENTITY_STORAGE_KEY,
  parseGuestIdentity,
} from "@/lib/auth";

type AuthGateProps = {
  children: ReactNode;
};

type AuthStatus = "guest" | "ready" | "restoring" | "signed-in";

type AuthContextValue = {
  errorMessage: string;
  isStartingGoogle: boolean;
  startGoogleSignIn: () => Promise<void>;
  status: AuthStatus;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthGate({ children }: AuthGateProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStartingGoogle, setIsStartingGoogle] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const storedGuest = readStoredGuestIdentity();

    async function restoreSession() {
      if (!supabase) {
        if (isMounted) {
          setStatus(storedGuest ? "guest" : "ready");
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage("Could not restore your session.");
      }

      setStatus(data.session ? "signed-in" : storedGuest ? "guest" : "ready");
    }

    void restoreSession();

    const { data } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setStatus(session ? "signed-in" : readStoredGuestIdentity() ? "guest" : "ready");
    }) ?? { data: { subscription: null } };

    return () => {
      isMounted = false;
      data.subscription?.unsubscribe();
    };
  }, [supabase]);

  function continueAsGuest() {
    const guest =
      readStoredGuestIdentity() ??
      createGuestIdentity({
        createdAt: new Date().toISOString(),
        id: window.crypto.randomUUID(),
      });

    window.localStorage.setItem(GUEST_IDENTITY_STORAGE_KEY, JSON.stringify(guest));
    setErrorMessage("");
    setStatus("guest");
  }

  const continueWithGoogle = useCallback(async () => {
    if (!supabase || isStartingGoogle) {
      return;
    }

    setErrorMessage("");
    setIsStartingGoogle(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setErrorMessage("Could not start Google sign-in. Please try again.");
      setIsStartingGoogle(false);
    }
  }, [isStartingGoogle, supabase]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      errorMessage,
      isStartingGoogle,
      startGoogleSignIn: continueWithGoogle,
      status,
    }),
    [continueWithGoogle, errorMessage, isStartingGoogle, status],
  );

  if (status === "restoring") {
    return <AuthLoadingScreen />;
  }

  if (status === "guest" || status === "signed-in") {
    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
  }

  return (
    <main className="app-screen grid min-h-dvh w-full place-items-center px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] text-[var(--app-text)]">
      <section className="grid w-full max-w-sm gap-7 text-center">
        <div className="grid justify-items-center gap-4">
          <div
            aria-hidden="true"
            className="size-20 rounded-[1.5rem] bg-cover bg-center shadow-[var(--app-shadow-soft)]"
            style={{ backgroundImage: 'url("/icons/flashify-icon-192.png")' }}
          />
          <div className="grid gap-2">
            <h1 className="text-3xl font-black tracking-normal">Flashify</h1>
            <p className="text-sm font-semibold leading-6 text-[var(--app-text-muted)]">
              Learn on this device, or sign in to prepare your cards for sync.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <button
            className="flex h-13 items-center justify-center gap-2 rounded-full bg-[var(--app-primary)] px-5 text-sm font-black text-[var(--app-primary-contrast)] shadow-[var(--app-shadow-soft)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!supabase || isStartingGoogle}
            onClick={() => void continueWithGoogle()}
            type="button"
          >
            <LogIn aria-hidden="true" size={18} strokeWidth={2.5} />
            {isStartingGoogle ? "Opening Google" : "Continue with Google"}
          </button>
          <button
            className="flex h-13 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-5 text-sm font-black text-[var(--app-text)]"
            onClick={continueAsGuest}
            type="button"
          >
            <UserRound aria-hidden="true" size={18} strokeWidth={2.3} />
            Continue as guest
          </button>
        </div>

        {!supabase ? (
          <p className="text-xs font-semibold leading-5 text-[var(--app-text-muted)]">
            Google sign-in is not configured on this device yet.
          </p>
        ) : null}
        {errorMessage ? (
          <p className="text-xs font-semibold leading-5 text-[var(--app-danger)]" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export function useFlashifyAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useFlashifyAuth must be used inside AuthGate.");
  }

  return context;
}

function AuthLoadingScreen() {
  return (
    <main className="app-screen grid min-h-dvh w-full place-items-center px-6 text-[var(--app-text)]">
      <div className="grid justify-items-center gap-4 text-center">
        <div
          aria-hidden="true"
          className="size-16 rounded-[1.25rem] bg-cover bg-center shadow-[var(--app-shadow-soft)]"
          style={{ backgroundImage: 'url("/icons/flashify-icon-192.png")' }}
        />
        <LoaderCircle
          aria-label="Restoring your session"
          className="animate-spin text-[var(--app-primary)]"
          size={24}
        />
      </div>
    </main>
  );
}

function readStoredGuestIdentity() {
  return parseGuestIdentity(
    window.localStorage.getItem(GUEST_IDENTITY_STORAGE_KEY),
  );
}

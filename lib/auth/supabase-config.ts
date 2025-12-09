export type SupabaseConfig = {
  publishableKey: string;
  url: string;
};

type PublicEnvironment = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

export function readSupabaseConfig(
  environment: PublicEnvironment,
): SupabaseConfig | null {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
      return null;
    }
  } catch {
    return null;
  }

  return { publishableKey, url };
}

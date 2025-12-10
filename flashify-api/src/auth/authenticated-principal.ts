export type AuthenticatedPrincipal = {
  avatarUrl: string | null;
  displayName: string | null;
  userId: string;
  email: string | null;
};

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  principal?: AuthenticatedPrincipal;
};

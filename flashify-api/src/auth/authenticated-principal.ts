export type AuthenticatedPrincipal = {
  userId: string;
  email: string | null;
};

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  principal?: AuthenticatedPrincipal;
};

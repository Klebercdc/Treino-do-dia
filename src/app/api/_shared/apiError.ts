export function buildApiError(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return Response.json(
    {
      ok: false,
      error,
      message,
      ...(extra ?? {}),
    },
    { status },
  );
}

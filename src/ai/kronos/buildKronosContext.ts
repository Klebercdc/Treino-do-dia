// eslint-disable-next-line @typescript-eslint/no-var-requires
const kronosContextHub = require('../../server/apihelpers/_kronosContextHub') as {
  buildKronosContext: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

interface BuildKronosContextOptions {
  userId?: string;
  user_id?: string;
  id?: string;
  message?: string;
  queryText?: string;
  query?: string;
  screenContext?: unknown;
  [key: string]: unknown;
}

export async function buildKronosContext(
  options?: BuildKronosContextOptions
): Promise<Record<string, unknown>> {
  return kronosContextHub.buildKronosContext(options ?? {});
}

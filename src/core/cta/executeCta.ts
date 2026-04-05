type KroniaCta = {
  action?: string | null;
  label?: string | null;
  payload?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

type KroniaCtaContext = {
  executeConversationCta?: (input: {
    action: string;
    label?: string | null;
    payload?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  }) => unknown;
  handleKroniaCTA?: (action: string, payload?: Record<string, unknown>, meta?: Record<string, unknown>) => unknown;
};

export async function executeCta(cta: KroniaCta, ctx?: KroniaCtaContext) {
  try {
    if (!cta || !cta.action) {
      console.error('CTA inválido', cta);
      return false;
    }

    const safePayload = cta.payload && typeof cta.payload === 'object' ? cta.payload : {};
    const safeMeta = cta.meta && typeof cta.meta === 'object' ? cta.meta : {};
    const runtime = ctx || (typeof window !== 'undefined' ? (window as unknown as KroniaCtaContext) : undefined);

    if (runtime?.executeConversationCta) {
      return !!runtime.executeConversationCta({
        action: cta.action,
        label: cta.label || null,
        payload: safePayload,
        meta: safeMeta,
      });
    }

    if (runtime?.handleKroniaCTA) {
      return !!runtime.handleKroniaCTA(cta.action, safePayload, safeMeta);
    }

    switch (cta.action) {
      case 'open_training':
        window.location.href = '/app/treino';
        return true;
      case 'open_diet':
      case 'generate_diet':
        window.location.href = '/app/dieta';
        return true;
      case 'open_kronos':
        window.location.href = '/app/chat';
        return true;
      default:
        console.warn('CTA não mapeado:', cta.action);
        return false;
    }
  } catch (err) {
    console.error('Erro ao executar CTA:', err);
    return false;
  }
}

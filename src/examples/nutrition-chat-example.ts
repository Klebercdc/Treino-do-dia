import { supabaseClient } from '../lib/supabase/client';

export async function sendNutritionMessage(conversationId: string, userMessage: string) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) throw new Error('Usuário não autenticado');

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ conversationId, userMessage }),
  });

  if (!response.ok) {
    const errorPayload = await response.json();
    throw new Error(errorPayload.error ?? 'Falha ao gerar resposta nutricional');
  }

  return response.json();
}

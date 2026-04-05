import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { execFile } from 'child_process';
import { promisify } from 'util';

loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

const execFileAsync = promisify(execFile);

type HealthPayload = {
  status?: string;
  scientific?: {
    articles?: number | null;
    evidence?: number | null;
    topics?: number | null;
    exercisesActive?: number | null;
    referenceMode?: string | null;
    error?: string | null;
  };
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }
}

async function sendTelegram(message: string): Promise<void> {
  const chatId = process.env.CHAT_ID?.trim();
  if (!chatId) return;
  await execFileAsync('bash', ['scripts/send_telegram.sh', chatId, message], {
    cwd: process.cwd(),
    env: process.env,
  });
}

async function main() {
  const baseUrl = required('KRONIA_APP_BASE_URL').replace(/\/+$/, '');
  const health = (await fetchJson(`${baseUrl}/api/system/health`)) as HealthPayload;
  const scientific = health.scientific || {};

  const issues: string[] = [];
  if (health.status !== 'ok') issues.push(`health=${health.status || 'unknown'}`);
  if ((scientific.articles || 0) <= 0) issues.push('scientific_articles=0');
  if ((scientific.evidence || 0) <= 0) issues.push('scientific_evidence=0');
  if ((scientific.exercisesActive || 0) < 1000) issues.push(`exercises_active=${scientific.exercisesActive || 0}`);
  if (scientific.referenceMode !== 'scientific_tables') issues.push(`reference_mode=${scientific.referenceMode || 'unknown'}`);
  if (scientific.error) issues.push(`scientific_error=${scientific.error}`);

  const summary =
    issues.length === 0
      ? `KRONIA monitor OK\nhealth=${health.status}\nscientific=${scientific.articles} artigos / ${scientific.evidence} evidências / ${scientific.topics} tópicos\nexercícios ativos=${scientific.exercisesActive}`
      : `KRONIA monitor ALERTA\n${issues.join('\n')}`;

  console.log(summary);
  await sendTelegram(summary);

  if (issues.length > 0) process.exit(1);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  try {
    await sendTelegram(`KRONIA monitor FALHOU\n${message}`);
  } catch {}
  process.exit(1);
});

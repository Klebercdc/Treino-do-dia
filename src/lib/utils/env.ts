import process from 'node:process';
export * from './env.server';

// Mantido por compatibilidade para imports existentes.
export const __envRuntime = typeof process !== 'undefined' ? 'server' : 'unknown';

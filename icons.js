/* ═══════════════════════════════════════
   TITAN PRO — Lucide Icon Helper
   Gera SVG inline usando a lib Lucide UMD
═══════════════════════════════════════ */

/**
 * Retorna SVG inline do ícone Lucide.
 * @param {string} name  - nome do ícone (ex: 'flame', 'dumbbell')
 * @param {number} size  - tamanho em px (padrão 18)
 * @param {string} cls   - classe CSS adicional
 */
function _ico(name, size = 18, cls = '') {
  if (typeof lucide === 'undefined') return '';
  try {
    const el = lucide.createElement(name);
    el.setAttribute('width', size);
    el.setAttribute('height', size);
    el.setAttribute('stroke-width', '1.75');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    if (cls) el.setAttribute('class', 'lucide ' + cls);
    else el.setAttribute('class', 'lucide');
    el.style.display = 'inline';
    el.style.verticalAlign = 'middle';
    el.style.flexShrink = '0';
    return el.outerHTML;
  } catch (e) {
    return '';
  }
}

/** Atalhos para tamanhos comuns */
const _icoSm  = (name, cls = '') => _ico(name, 14, cls);
const _icoMd  = (name, cls = '') => _ico(name, 18, cls);
const _icoLg  = (name, cls = '') => _ico(name, 22, cls);
const _icoXl  = (name, cls = '') => _ico(name, 28, cls);

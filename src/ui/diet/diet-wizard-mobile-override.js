/* Legacy diet wizard mobile override removed.
 * Prevents cached mobile override code from wrapping or reopening the removed wizard.
 */
(function() {
  function cleanup() {
    try { localStorage.removeItem('kronia_diet_wizard_state_v1'); } catch (_) {}
    try { localStorage.removeItem('kronia_diet_wizard_state_v2'); } catch (_) {}
    try { localStorage.removeItem('kronia_diet_wizard_state_v6_standalone'); } catch (_) {}
    var old = document.getElementById('dietProfileWizardScreen');
    if (old) old.remove();
    document.body && document.body.classList.remove('diet-wizard-active', 'kdw-active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup, { once: true });
  } else {
    cleanup();
  }
})();

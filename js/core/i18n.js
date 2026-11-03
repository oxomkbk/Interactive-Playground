/* =========================================================================
   I18N — English / 简体中文. Every user-facing string passes through t(); English text is the key,
   so untranslated strings simply fall back to English. Static HTML uses data-i18n="key" attributes.
   ========================================================================= */
import { ZH } from './lang-zh.js';

const LANGS = { en: 'English', zh: '中文' };
let LANG = 'en';
try { const s = localStorage.getItem('hollowmoor-lang'); if (s && LANGS[s]) LANG = s; else if (/^zh/i.test(navigator.language || '')) LANG = 'zh'; } catch (e) {}
const LISTENERS = [];

// t('Time {a}', { a: 3 }) → looks the template up, then fills {placeholders}
function t(s, vars) {
  if (s == null) return '';
  let out = LANG === 'zh' && ZH[s] !== undefined ? ZH[s] : String(s);
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return out;
}
function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.body.classList.toggle('lang-zh', LANG === 'zh');
}
function setLang(l) {
  if (!LANGS[l]) return; LANG = l;
  try { localStorage.setItem('hollowmoor-lang', l); } catch (e) {}
  applyStatic(); for (const f of LISTENERS) f(l);
}
const getLang = () => LANG;
const onLang = f => LISTENERS.push(f);

export { LANGS, t, setLang, getLang, onLang, applyStatic };

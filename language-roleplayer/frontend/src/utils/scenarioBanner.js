/** CSS linear-gradient for scenario card / preview banners by language code. */
export function scenarioBannerBackground(lang) {
  const map = {
    en: 'linear-gradient(135deg, #012169, #C8102E 50%, #012169)',
    fr: 'linear-gradient(135deg, #003189, #0055a4 60%, #ef4135)',
    es: 'linear-gradient(135deg, #aa151b, #f1bf00 60%, #aa151b)',
    de: 'linear-gradient(135deg, #000, #dd0000 50%, #ffce00)',
    ja: 'linear-gradient(135deg, #BC002D, #ffffff 60%, #BC002D)',
    zh: 'linear-gradient(135deg, #DE2910, #FFDE00 80%)',
    it: 'linear-gradient(135deg, #009246, #fff 50%, #ce2b37)',
    pt: 'linear-gradient(135deg, #006600, #ff0000 80%)',
    ko: 'linear-gradient(135deg, #003478, #cd2e3a 80%)',
  };
  return map[lang] || 'linear-gradient(135deg, #1B4F72, #2E86C1)';
}

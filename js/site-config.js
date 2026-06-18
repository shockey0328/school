/**
 * 与线上一致的站点根路径（可选）。
 *
 * - 根目录部署（https://域名/index.html）：保持 ''，与本地 serve-local 默认行为一致。
 * - 子路径部署（https://域名/某路径/index.html）：填写与线上一致的 Web 路径，如 '/xueqing/'
 *   （须以 / 开头、建议以 / 结尾）。此时 Web 服务器必须在同一路径下提供本套 html/css/js/data。
 *
 * 修改本文件后，本地与线上应使用相同配置再验收。
 */
(function () {
  var GUANGDA_SITE_BASE = '';

  var base = typeof GUANGDA_SITE_BASE === 'string' ? GUANGDA_SITE_BASE.trim() : '';
  if (!base) {
    return;
  }
  var href = base;
  if (href.charAt(0) !== '/') {
    console.warn('[site-config] GUANGDA_SITE_BASE 建议以 / 开头:', base);
  }
  if (href.slice(-1) !== '/') {
    href += '/';
  }
  var head = document.head || document.getElementsByTagName('head')[0];
  if (!head) {
    return;
  }
  var existing = head.querySelector('base[data-guangda-site-base]');
  if (existing) {
    existing.href = href;
    return;
  }
  var el = document.createElement('base');
  el.setAttribute('data-guangda-site-base', '1');
  el.href = href;
  head.insertBefore(el, head.firstChild);
})();

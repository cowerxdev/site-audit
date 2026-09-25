(function (root) {
  'use strict';
  const HEADER = ['url', 'host', 'audited_at', 'module', 'check_id', 'label', 'status', 'weight', 'evidence', 'fix'];
  function cell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function rows(result) {
    const modules = result?.modules || [{id: 'basics', label: 'Essentials', checks: result?.checks || []}];
    return modules.flatMap(mod => (mod.checks || []).map(c => [result.url, result.host, result.auditedAt || result.meta?.auditedAt, mod.label || mod.id, c.id, c.label, c.status, c.weight, c.evidence, c.fix]));
  }
  function toCsvMany(results) { return [HEADER, ...(results || []).flatMap(rows)].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'; }
  function toCsv(result) { return toCsvMany([result]); }
  function compare(a, b) {
    const modsA = a?.modules || [], modsB = b?.modules || [];
    const moduleIds = [...new Set([...modsA, ...modsB].map(m => m.id))];
    const modules = moduleIds.map(id => {
      const left = modsA.find(m => m.id === id), right = modsB.find(m => m.id === id);
      return {id, label: left?.label || right?.label || id,
        a: {score: left?.score ?? null, grade: left?.grade || '–'}, b: {score: right?.score ?? null, grade: right?.grade || '–'},
        delta: left?.score == null || right?.score == null ? null : right.score - left.score};
    });
    const flatten = result => (result?.modules || []).flatMap(m => (m.checks || []).map(c => ({...c, module: m.id})));
    const ca = flatten(a), cb = flatten(b);
    const ids = [...new Set([...ca, ...cb].map(c => c.id))];
    const checks = ids.map(id => {
      const left = ca.find(c => c.id === id), right = cb.find(c => c.id === id);
      return {id, label: left?.label || right?.label || id, module: left?.module || right?.module || '',
        a: left?.status || 'missing', b: right?.status || 'missing', aEvidence: left?.evidence || '', bEvidence: right?.evidence || '',
        differs: (left?.status || 'missing') !== (right?.status || 'missing')};
    });
    return {modules, checks};
  }
  root.SiteAuditorExport = {toCsv, toCsvMany, compare};
  if (typeof module !== 'undefined') module.exports = root.SiteAuditorExport;
})(globalThis);

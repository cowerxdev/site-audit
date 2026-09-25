(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  // These patterns and the link scan mirror test-30/cpa_checks.py. In particular,
  // a portal link also qualifies for its combined upload-or-payment check.
  const PORTAL = /portal|sharefile|taxdome|clientaxcess|smartvault|liscio|suralink|karbon|ssportal|safesend|client[\s-]*login|client[\s-]*access|client[\s-]*center|my[\s-]*account(?!ant)|secure[\s-]*(login|client)|canopy|egnyte|citrix|onvio|clientspace|clientwise|fileroom/i;
  const UPLOAD_T = /upload|send[\s-]*(us[\s-]*)?(a[\s-]*)?(files?|documents?|docs)|secure[\s-]*(file|document|drop|transfer|share|email|message)|drop[\s-]*off/i;
  const UPLOAD_H = /sharefile|smartvault|dropbox\.com|filedrop|liscio|suralink|safesend|taxdome|clientaxcess|onvio|clientportal\.com|netlinksolution|thomsonreuters|link\.intuit\.com|egnyte|ssportal/i;
  const PAY = /pay[\s-]*(online|now|invoice|bill|my|here)|pay[\s-]*(a|your)[\s-]*(bill|invoice)|make[\s-]*a[\s-]*payment|cpacharge|gotobilling|lawpay|paypal|stripe|bill\.com|invoice|authorize\.net|paylink|e-?payment|payments\.(intuit|quickbooks)|quickbooks\.intuit\.com\/pay|square\.link/i;
  const BOOK = /call[\s-]*to[\s-]*schedule|consultation|request[\s-]*(an?[\s-]*)?(quote|appointment|call)|schedule[\s-]*(a|an|your|now|online|call|meeting|consult|appointment|time|with)|book[\s-]*(a|an|your|now|online|appointment|consult|call|meeting|time)|appointment|calendly|acuity|hubspot\.com\/meetings|savvycal|tidycal|setmore|oncehub|youcanbook|zoom\.us\/(j|schedule)|square\.site\/appointments|msbookings|bookings\.microsoft|meetings\.hubspot|cal\.com|reserve[\s-]*(a|your)/i;
  const c = (id, label, weight, status, evidence, fix) => L.check(`vertical_cpa.${id}`, label, weight, status, evidence, fix);
  function links(doc) {
    return [...doc.querySelectorAll('a, iframe[src], form[action], button[src], button[action]')].map(el => ({
      href: el.getAttribute(el.hasAttribute('href') ? 'href' : el.hasAttribute('src') ? 'src' : 'action') || '',
      text: el.localName === 'a' ? el.textContent || '' : ''
    }));
  }
  function hit(list, textPattern, hrefPattern = textPattern) {
    return list.find(x => textPattern.test(x.text) || hrefPattern.test(x.href));
  }
  function evidence(x) { return x ? L.trim(x.text, 40) || x.href.slice(0, 60) : 'No matching link found'; }
  function run(doc, ctx) {
    if (!ctx) { ctx = doc; doc = ctx.doc; }
    const list = links(doc), portal = hit(list, PORTAL), upload = hit(list, UPLOAD_T, UPLOAD_H), pay = hit(list, PAY), booking = hit(list, BOOK);
    const combined = upload || pay;
    return {checks: [
      c('portal_link', 'Client portal link', 2, portal ? 'pass' : 'fail', evidence(portal), 'Add a clearly labelled client portal or login link to the homepage.'),
      c('upload_or_pay_link', 'Secure file or payment link', 2, combined ? 'pass' : 'fail', evidence(combined), 'Link to a secure file upload or online payment path from the homepage.'),
      c('booking_path', 'Consultation booking path', 2, booking ? 'pass' : 'fail', evidence(booking), 'Add a consultation or appointment request link to the homepage.'),
      c('secure_upload', 'Secure document upload', 1, upload ? 'pass' : 'warn', evidence(upload), 'Add a labelled secure document upload link for clients.'),
      c('online_payment', 'Online payment', 1, pay ? 'pass' : 'warn', evidence(pay), 'Add a clearly labelled online payment link for clients.')
    ], data: {}};
  }
  M.vertical_cpa = {id: 'vertical_cpa', label: 'CPA', run};
})(globalThis);

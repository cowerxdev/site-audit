(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const specs = [
    ['phone', 'Phone number', 2], ['nap', 'Name, address, phone consistency', 2],
    ['address', 'Street address', 1], ['hours', 'Business hours', 1],
    ['map', 'Embedded map', 1], ['click_to_call', 'Tap-to-call link', 2], ['directions', 'Directions link', 1]
  ];
  function c(name, status, evidence, fix = '') {
    const [, label, weight] = specs.find(item => item[0] === name);
    return L.check(`local.${name}`, label, weight, status, evidence, fix);
  }
  const short = (v, max = 120) => L.trim(v, max);
  const digits = value => String(value || '').replace(/\D/g, '');
  function phone(value) {
    let d = digits(value);
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    return d.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? d : null;
  }
  const display = d => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  const phonePattern = /(?<!\d)(?:\+?1[\s.-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[\s.-]?[2-9]\d{2}[\s.-]?\d{4}(?!\d)/g;
  const suffix = '(?:Street|St\\.?|Avenue|Ave\\.?|Road|Rd\\.?|Boulevard|Blvd\\.?|Drive|Dr\\.?|Way|Lane|Ln\\.?|Parkway|Pkwy\\.?|Highway|Hwy\\.?|Court|Ct\\.?|Place|Pl\\.?)';
  const addressPattern = new RegExp(`(?<![\\d-])\\b\\d{1,6}\\s+(?:(?:\\d{1,3}(?:st|nd|rd|th)|[A-Za-z][A-Za-z.'-]*)\\s+){1,5}${suffix}(?:\\s*,?\\s*(?:Suite|Ste\\.?|Unit|#)\\s*[A-Za-z0-9-]+)?\\s*,\\s*[A-Za-z][A-Za-z .'-]{1,45},?\\s+[A-Z]{2}\\s+\\d{5}(?:-\\d{4})?\\b`, 'gi');
  const suffixWords = {st: 'street', ave: 'avenue', rd: 'road', blvd: 'boulevard', dr: 'drive', ln: 'lane', pkwy: 'parkway', hwy: 'highway', ct: 'court', pl: 'place', ste: 'suite'};
  function normalizeAddress(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).map(x => suffixWords[x] || x).join(' ');
  }
  function addressParts(value) {
    const s = String(value || '');
    return {number: /\b\d{1,6}\b/.exec(s)?.[0] || '', zip: /\b\d{5}(?:-\d{4})?\b/.exec(s)?.[0]?.slice(0, 5) || ''};
  }
  const addressValue = obj => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return [obj.streetAddress, obj.addressLocality, obj.addressRegion, obj.postalCode].filter(Boolean).join(', ');
  };
  function addressMatches(a, b) {
    const x = addressParts(a), y = addressParts(b);
    return Boolean(x.number && x.zip && x.number === y.number && x.zip === y.zip) || normalizeAddress(a) === normalizeAddress(b);
  }
  function shortAddress(value, max = 90) {
    const raw = String(value || '');
    const zip = raw.match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
    if (!zip || raw.length <= max) return short(raw, max);
    return `${short(raw.slice(0, raw.indexOf(zip)).replace(/[\s,]+$/, ''), max - zip.length - 3)}… ${zip}`;
  }
  function run(ctx) {
    try {
      const doc = ctx.doc;
      const text = L.bodyText(doc).slice(0, 250000);
      const json = L.jsonLd(doc).slice(0, 300);
      const phones = new Map(), faxes = new Map();
      function addNumber(value, source, fax = false) {
        const d = phone(value);
        if (!d) return;
        const destination = fax ? faxes : phones;
        const item = destination.get(d) || {digits: d, display: display(d), count: 0, sources: []};
        item.count++;
        if (!item.sources.includes(source)) item.sources.push(source);
        destination.set(d, item);
      }
      const telLinks = [...doc.querySelectorAll('a[href^="tel:" i]')].slice(0, 400);
      for (const el of telLinks) addNumber((el.getAttribute('href') || '').slice(4).split(/[;?]/)[0], 'tel', L.faxLabel(doc, el));
      const phoneTelLinks = telLinks.filter(el => !L.faxLabel(doc, el));
      // Match within each text node. Concatenating element text can turn a ZIP and
      // an adjacent phone into a plausible number that was never on the page.
      if (doc.body) {
        const walker = doc.createTreeWalker(doc.body, 4);
        let node, remaining = 250000;
        while ((node = walker.nextNode()) && remaining > 0) {
          if (node.parentElement?.closest('script, style, noscript, template, svg, [hidden]')) continue;
          const value = node.nodeValue.slice(0, remaining);
          remaining -= value.length;
          for (const hit of value.matchAll(phonePattern)) {
            const before = value.slice(0, hit.index), after = value.slice(hit.index + hit[0].length);
            if (/(?:\d[.-])$/.test(before) || /^[.-]\d/.test(after)) continue;
            addNumber(hit[0], 'text', L.faxLabel(doc, node, hit.index));
          }
        }
      }
      const businesses = json.filter(obj => obj && typeof obj === 'object' && !Array.isArray(obj) &&
        (L.types(obj).some(t => /^(?:Organization|LocalBusiness|ProfessionalService|LegalService|Attorney|AccountingService|Dentist|MedicalBusiness|HomeAndConstructionBusiness|Plumber|Electrician|HVACBusiness|RoofingContractor|GeneralContractor|AutoRepair|Restaurant|Store)$/i.test(t)) || (obj.telephone && obj.address && !L.types(obj).includes('Person'))));
      for (const obj of businesses) {
        for (const value of Array.isArray(obj.telephone) ? obj.telephone : [obj.telephone]) if (value) addNumber(value, 'jsonld');
        for (const value of Array.isArray(obj.faxNumber) ? obj.faxNumber : [obj.faxNumber]) if (value) addNumber(value, 'jsonld', true);
      }
      // A number labelled fax anywhere on the page is a fax everywhere: headers often print it bare.
      for (const d of faxes.keys()) {
        if (!phoneTelLinks.some(el => phone((el.getAttribute('href') || '').slice(4).split(/[;?]/)[0]) === d)) phones.delete(d);
      }
      const pagePhones = [...phones.values()].filter(item => item.sources.some(s => s !== 'jsonld'));
      const addresses = [];
      for (const hit of text.matchAll(addressPattern)) {
        if (addresses.length >= 100) break;
        if (!addresses.some(x => normalizeAddress(x) === normalizeAddress(hit[0]))) addresses.push(shortAddress(hit[0], 180));
      }
      const structuredAddresses = json.filter(obj => L.types(obj).includes('PostalAddress')).map(addressValue).filter(Boolean);
      const data = {phones: [...phones.values()], faxes: [...faxes.values()], addresses: [...new Set([...addresses, ...structuredAddresses])].slice(0, 100)};
      const checks = [];
      checks.push(c('phone', pagePhones.length ? 'pass' : 'fail', pagePhones.length ? pagePhones.map(x => x.display).slice(0, 3).join(', ') : 'No US phone number found', 'The homepage has no visible phone number, so visitors cannot find a number to call.'));
      let napStatus = 'warn', napEvidence = 'No LocalBusiness/Organization data to compare';
      if (!businesses.length && pagePhones.length > 2) napEvidence += `; ${pagePhones.length} page phones: ${pagePhones.map(p => p.display).join(', ')}`;
      if (businesses.length) {
        const mismatches = new Set(), warnings = new Set();
        const seen = new Set();
        for (const business of businesses.slice(0, 10)) {
          const schemaPhones = (Array.isArray(business.telephone) ? business.telephone : [business.telephone]).map(phone).filter(Boolean);
          const schemaAddress = addressValue(business.address);
          const identity = `${[...new Set(schemaPhones)].sort().join(',')}|${normalizeAddress(schemaAddress)}`;
          if (seen.has(identity)) continue;
          seen.add(identity);
          if (schemaPhones.length && pagePhones.length) {
            if (!schemaPhones.some(d => pagePhones.some(p => p.digits === d))) mismatches.add(`JSON-LD phone ${[...new Set(schemaPhones)].slice(0, 3).map(display).join(', ')} vs page ${pagePhones.slice(0, 3).map(p => p.display).join(', ')}`);
          } else if (schemaPhones.length) warnings.add('Phone appears only in structured data (not visible on the page)');
          else if (pagePhones.length) warnings.add('Structured data has no telephone');
          if (schemaAddress && addresses.length) {
            const schemaParts = addressParts(schemaAddress);
            const comparable = addresses.filter(a => { const parts = addressParts(a); return parts.number && parts.zip && schemaParts.number && schemaParts.zip; });
            if (comparable.length && !comparable.some(a => addressMatches(a, schemaAddress))) mismatches.add(`JSON-LD address ${shortAddress(schemaAddress, 55)} vs page ${shortAddress(addresses[0], 55)}`);
            else if (!comparable.length) warnings.add('Address could not be compared by street number and ZIP');
          } else if (schemaAddress) warnings.add('Address appears only in structured data (not visible on the page)');
          else if (addresses.length) warnings.add('Structured data has no address');
        }
        if (mismatches.size) {
          napStatus = 'fail';
          const details = [...mismatches].sort((a, b) => Number(b.startsWith('JSON-LD address')) - Number(a.startsWith('JSON-LD address')));
          napEvidence = details[0];
          let shown = 1;
          for (const detail of details.slice(1)) if (napEvidence.length + detail.length + 2 <= 175) { napEvidence += `; ${detail}`; shown++; }
          if (shown < details.length) napEvidence += `; ${details.length - shown} more differences`;
        }
        else if (warnings.size) { napStatus = 'warn'; napEvidence = [...warnings].join('; '); }
        else if (pagePhones.length > 2 && pagePhones.some(p => !p.sources.includes('jsonld'))) {
          napStatus = 'warn'; napEvidence = `${pagePhones.length} page phones: ${pagePhones.map(p => p.display).join(', ')}`;
        } else { napStatus = 'pass'; napEvidence = `${pagePhones.map(p => p.display).join(', ') || 'No page phone'}; ${short(addresses[0] || 'No page address', 90)} matches JSON-LD`; }
      }
      const napDetail = short(napEvidence, 80);
      checks.push(c('nap', napStatus, napEvidence, napStatus === 'fail' ? `The page's visible business details differ from its structured listing (${napDetail}), so the business contact details conflict.` : !businesses.length ? `The page has no structured business listing${pagePhones.length > 2 ? ` and shows ${pagePhones.length} phone numbers` : ''}, so its primary contact details are unclear to search engines.` : `The page's visible and structured business details are incomplete (${napDetail}), so its primary contact details are unclear.`));
      checks.push(c('address', addresses.length ? 'pass' : 'warn', addresses.length ? addresses[0] : 'No US street address found in page text', 'The homepage has no street address, so visitors cannot find the business location on the page.'));
      const hoursObj = businesses.find(obj => obj.openingHours || obj.openingHoursSpecification);
      const hoursText = /\b(?:Mon(?:day)?\s*[-–]\s*Fri(?:day)?\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)|Monday\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)|Hours\s*:\s*[^\n]{0,45}\d{1,2}(?::\d{2})?\s*(?:am|pm))/i.exec(text);
      const hours = hoursObj ? short(JSON.stringify(hoursObj.openingHours || hoursObj.openingHoursSpecification), 120) : hoursText?.[0];
      checks.push(c('hours', hours ? 'pass' : 'warn', hours || 'No business hours found', 'The homepage has no business hours, so visitors cannot tell when the business is open.'));
      const mapPattern = /(?:google\.com\/maps(?:\/embed)?|maps\.google\.|maps\.googleapis\.com\/maps\/api\/(?:js|staticmap)|mapbox|bing\.com\/maps|openstreetmap)/i;
      const map = [...doc.querySelectorAll('iframe[src], img[src], script[src]')].slice(0, 500).find(el => mapPattern.test(el.getAttribute('src') || '') && (el.tagName === 'IFRAME' || /(?:google\.com\/maps|maps\.google\.|maps\.googleapis\.com\/maps\/api\/(?:js|staticmap))/i.test(el.getAttribute('src') || '')));
      checks.push(c('map', map ? 'pass' : 'warn', map ? short(map.getAttribute('src'), 140) : 'No embedded map found', 'The homepage has no location map, so visitors must look elsewhere to see where the business is.'));
      checks.push(c('click_to_call', phoneTelLinks.length ? 'pass' : pagePhones.length ? 'fail' : 'na', phoneTelLinks.length ? short(phoneTelLinks[0].getAttribute('href'), 100) : pagePhones.length ? `Phone in text: ${pagePhones[0].display}; no tel link` : 'No phone to link', `The phone number ${pagePhones[0]?.display || ''} is not a tap-to-call link, so mobile visitors have to copy it by hand.`));
      const directionsPattern = /(?:google\.com\/maps(?:\/(?:dir|place|search)|\/?\?q=)|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl|g\.page|maps\.apple\.com|bing\.com\/maps|waze\.com)/i;
      const direction = [...doc.querySelectorAll('a[href]')].slice(0, 1000).find(el => directionsPattern.test(el.getAttribute('href') || ''));
      checks.push(c('directions', direction ? 'pass' : 'warn', direction ? short(direction.getAttribute('href'), 140) : 'No directions link found', 'The homepage has no directions link, so visitors must search for the business location themselves.'));
      return {checks, data};
    } catch (error) {
      return {checks: specs.map(([name]) => c(name, 'na', `Unable to inspect page: ${short(error?.message || error, 100)}`)), data: {phones: [], faxes: [], addresses: []}};
    }
  }
  M.local = {id: 'local', label: 'Local', run};
})(globalThis);

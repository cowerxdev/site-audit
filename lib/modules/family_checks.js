(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const rules = {
    'professional-services': [
      ['services', 'Services or practice areas', 'link', /services|practice areas|expertise|what we do/i, 'Link to your services or practice areas.'],
      ['people', 'Team or practitioner profiles', 'link', /our team|our people|attorneys|professionals|staff|about us/i, 'Link to profiles for the people clients will work with.'],
      ['consultation', 'Consultation or inquiry path', 'action', /consult|appointment|book|contact|request/i, 'Make it easy to request a consultation or contact your team.']
    ],
    'appointment-services': [
      ['booking', 'Online booking path', 'action', /book|appointment|reserv|schedul/i, 'Link to an online booking or appointment request path.'],
      ['services', 'Service list', 'link', /services|treatments|procedures/i, 'List and link to the services offered.'],
      ['prices', 'Prices or rates', 'text', /\b(?:prices?|pricing|rates?|from \$\d+|starting at)\b/i, 'Publish prices or a clear starting rate where appropriate.']
    ],
    'food-and-venue': [
      ['menu', 'Menu or offering', 'link', /menu|food|drinks|catering/i, 'Link to an up-to-date menu or offering.'],
      ['hours', 'Opening hours', 'text', /\b(?:hours|open(?:ing)?\s+(?:times?|daily)|mon(?:day)?\s*[-–]\s*(?:fri|sun)|\d{1,2}\s*(?:am|pm)\s*[-–])\b/i, 'Show current opening hours.'],
      ['order_or_reserve', 'Order or reservation path', 'action', /order|reserv|book|table|private event/i, 'Link to online ordering or a reservation request.']
    ],
    'blue-collar-trades': [
      ['services', 'Service list', 'link', /services|repairs|install|what we do/i, 'Link to the services you provide.'],
      ['service_area', 'Service area', 'text', /service areas?|areas? we serve|serving (?:the|greater)|communities we serve/i, 'List the towns or areas you serve.'],
      ['quote', 'Quote or service request', 'action', /quote|estimate|request service|schedule|contact/i, 'Offer a clear quote or service request path.']
    ],
    'lessons-and-instruction': [
      ['schedule', 'Class or lesson schedule', 'link', /schedule|timetable|classes|lessons/i, 'Link to the current class or lesson schedule.'],
      ['pricing', 'Tuition or pricing', 'text', /\b(?:tuition|fees?|prices?|pricing|rates?)\b/i, 'Publish tuition, fees, or a pricing path.'],
      ['signup', 'Enrollment or sign-up', 'action', /enroll|register|sign up|book|apply/i, 'Provide a clear enrollment or registration path.']
    ],
    'retail-and-e-commerce': [
      ['shop', 'Shop or product catalog', 'link', /shop|products|collections|catalog|categories/i, 'Link to products or a catalog.'],
      ['cart', 'Cart or checkout', 'action', /cart|bag|checkout|buy now|add to cart/i, 'Offer a visible cart or checkout path.'],
      ['shipping', 'Shipping information', 'link', /shipping|delivery/i, 'Link to shipping and delivery information.'],
      ['returns', 'Returns information', 'link', /returns?|refunds?|exchanges?/i, 'Link to the returns or refund policy.']
    ],
    'community': [
      ['events', 'Events or program calendar', 'link', /events|calendar|programs|activities/i, 'Link to current events or programs.'],
      ['support', 'Donate or support path', 'action', /donat|give|support|volunteer|membership/i, 'Give visitors a clear way to support or volunteer.'],
      ['visit', 'Visit or service times', 'text', /\b(?:hours|visit us|service times|worship times|sunday service|open to the public)\b/i, 'Publish visit hours or service times.']
    ],
    'web-apps-and-products': [
      ['pricing', 'Pricing path', 'link', /pricing|plans|subscription/i, 'Link to clear pricing or plan information.'],
      ['signup', 'Sign-up or trial path', 'action', /sign up|sign-up|start free|try free|free trial|create account|get started/i, 'Offer a clear sign-up or trial path.'],
      ['docs', 'Documentation or help', 'link', /docs|documentation|help center|support|developers|api reference/i, 'Link to product documentation or help.']
    ]
  };
  const names = {
    'professional-services': 'Professional services', 'appointment-services': 'Appointment services',
    'food-and-venue': 'Food and venue', 'blue-collar-trades': 'Blue collar trades',
    'lessons-and-instruction': 'Lessons and instruction', 'retail-and-e-commerce': 'Retail and e-commerce',
    'community': 'Community', 'web-apps-and-products': 'Web apps and products'
  };
  for (const [family, checks] of Object.entries(rules)) {
    const id = `family_${family.replaceAll('-', '_')}`;
    M[id] = {id, label: names[family], run(doc, ctx) {
      if (!ctx) ctx = {doc};
      const text = L.bodyText(doc).slice(0, 200000);
      const links = [...doc.querySelectorAll('a[href], button, form[action]')].slice(0, 2000).map(el =>
        `${el.textContent || ''} ${el.getAttribute?.('href') || el.getAttribute?.('action') || ''}`);
      const result = checks.map(([key, label, kind, pattern, fix]) => {
        const match = kind === 'text' ? pattern.exec(text) : links.find(link => pattern.test(link));
        const evidence = match ? L.trim(typeof match === 'string' ? match : match[0], 100) : 'No matching homepage evidence found';
        return L.check(`${id}.${key}`, label, 2, match ? 'pass' : 'fail', evidence, fix);
      });
      return {checks: result, data: {}};
    }};
  }
})(globalThis);

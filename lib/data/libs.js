(function (root) {
  'use strict';
  root.SiteAuditorLibs = {asOf: '2024-06', libs: {
    jquery: {name: 'jQuery', current: '3.7.1', outdatedBelow: '3.5.0', note: 'versions before 3.5.0 have known XSS advisories (CVE-2020-11022/11023)'},
    jqueryUi: {name: 'jQuery UI', current: '1.13.3', outdatedBelow: '1.13.2', note: 'older releases have known security advisories'},
    jqueryMigrate: {name: 'jQuery Migrate', current: '3.4.1', outdatedBelow: '3.0.0', note: 'older major release'},
    bootstrap: {name: 'Bootstrap', current: '5.3.3', outdatedBelow: '5.0.0', note: 'Bootstrap 4 is an older major release'},
    angularjs: {name: 'AngularJS', current: '1.8.3', outdatedBelow: '999.0.0', note: 'AngularJS reached end of support in 2022', eol: true},
    react: {name: 'React', current: '18.3.1', outdatedBelow: '17.0.0', note: 'older major release'},
    vue: {name: 'Vue', current: '3.4.21', outdatedBelow: '3.0.0', note: 'Vue 2 reached end of life on 2023-12-31', eolBelow: '3.0.0'},
    moment: {name: 'Moment.js', current: '2.30.1', outdatedBelow: '3.0.0', note: 'Moment is in maintenance mode', maintenance: true},
    lodash: {name: 'Lodash', current: '4.17.21', outdatedBelow: '4.17.21', note: 'older releases have known security advisories'},
    underscore: {name: 'Underscore', current: '1.13.6', outdatedBelow: '1.13.0', note: 'older major release'},
    swiper: {name: 'Swiper', current: '11.1.4', outdatedBelow: '10.0.0', note: 'older major release'},
    gsap: {name: 'GSAP', current: '3.12.5', outdatedBelow: '3.0.0', note: 'older major release'},
    modernizr: {name: 'Modernizr', current: '3.13.0', outdatedBelow: '3.0.0', note: 'older major release'}
  }};
})(globalThis);

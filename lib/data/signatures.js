(function (root) {
  'use strict';
  root.SiteAuditorSignatures = {
    chat: [
      ['Intercom', /intercom(?:cdn)?\.(?:io|com)|intercom/i], ['Drift', /drift\.com|driftt/i],
      ['tawk.to', /tawk\.to/i], ['LiveChat', /livechat(?:inc)?\.com|livechat/i],
      ['Zendesk', /zopim|zdassets|zendesk/i], ['HubSpot conversations', /js\.hs-scripts|usemessages|hubspot.*conversations/i],
      ['Tidio', /tidio/i], ['Olark', /olark/i], ['Crisp', /crisp\.chat|crisp/i],
      ['Podium', /podium/i], ['Birdeye', /birdeye/i], ['Smith.ai', /smith\.ai/i],
      ['Ngage', /ngage/i], ['ApexChat', /apexchat/i], ['LiveHelpNow', /livehelpnow/i],
      ['Gorgias', /gorgias/i], ['Freshchat', /freshchat|freshworks.*chat/i],
      ['Facebook Messenger', /customerchat|fb-customerchat|facebook\.com\/plugins\/customerchat/i],
      ['Chatra', /chatra/i], ['Userlike', /userlike/i], ['Juvo Leads', /juvo.?leads/i],
      ['LawChat', /lawchat|lawyers.?live.?chat/i], ['CallRail chat', /callrail.*(?:form|chat)/i],
      ['Broadly webchat', /broadly.*(?:webchat|chat)/i], ['Heymarket', /heymarket|hey.?market/i],
      ['Signpost', /signpost/i], ['GoDaddy chat', /godaddy.*chat/i], ['Wix chat', /wix.*chat|chat.*wix/i]
    ],
    booking: [
      ['Calendly', /calendly/i], ['Acuity', /acuityscheduling|as\.me\//i],
      ['Square Appointments', /squareup\.com\/appointments|square\.site\/book/i],
      ['Vagaro', /vagaro/i], ['Jane', /janeapp\.com/i], ['Clio Grow', /clio/i],
      ['Lawmatics', /lawmatics/i], ['Setmore', /setmore/i], ['SimplyBook', /simplybook/i],
      ['Mindbody', /mindbody/i], ['Booksy', /booksy/i], ['Zocdoc', /zocdoc/i],
      ['NexHealth', /nexhealth/i], ['LocalMed', /localmed/i], ['Housecall Pro', /housecallpro/i],
      ['Jobber', /getjobber|jobber\.com/i], ['ServiceTitan', /servicetitan/i],
      ['Schedulicity', /schedulicity/i], ['GlossGenius', /glossgenius/i], ['Fresha', /fresha/i],
      ['Boulevard', /joinblvd|boulevard.*book/i], ['HubSpot meetings', /meetings\.hubspot|hubspot\.com\/meetings/i],
      ['OnceHub', /oncehub|scheduleonce/i], ['YouCanBookMe', /youcanbook\.me/i],
      ['Cal.com', /(?:^|[/.])cal\.com\//i], ['TidyCal', /tidycal/i], ['SavvyCal', /savvycal/i],
      ['Microsoft Bookings', /bookings\.microsoft|msbookings/i],
      ['Google Calendar appointments', /calendar\.app\.google|calendar\.google\.com\/calendar\/appointments/i],
      ['10to8', /10to8/i], ['Appointy', /appointy/i], ['Timely', /gettimely|timely.*book/i],
      ['Weave', /getweave|weave.*schedul/i], ['Solutionreach', /solutionreach/i],
      ['Doctible', /doctible/i], ['Yelp reservations', /yelp\.com\/reservations/i],
      ['OpenTable', /opentable/i], ['Resy', /resy\.com/i], ['Tock', /exploretock|tock\.com/i]
    ],
    reviews: [
      ['Birdeye', /birdeye/i], ['Podium', /podium/i], ['Trustpilot', /trustpilot/i],
      ['Elfsight reviews', /elfsight.*review|review.*elfsight/i], ['Trustindex', /trustindex/i],
      ['EmbedSocial', /embedsocial/i], ['NiceJob', /nicejob/i], ['Grade.us', /grade\.us/i],
      ['Reviews.io', /reviews\.io/i], ['Yotpo', /yotpo/i], ['Judge.me', /judge\.me/i],
      ['Stamped', /stamped\.io/i], ['BBB seal', /bbb\.org|betterbusinessbureau/i],
      ['Google reviews', /google.*reviews?|reviews?.*google|g\.page\/r\//i],
      ['Yelp embed', /yelp\.com.*(?:embed|review)/i], ['Avvo badge', /avvo/i],
      ['Super Lawyers badge', /superlawyers/i], ['Martindale', /martindale/i],
      ['Expertise.com', /expertise\.com/i], ['Clutch', /clutch\.co/i], ['Houzz', /houzz/i],
      ['Angi', /angi\.com|angieslist/i], ['HomeAdvisor', /homeadvisor/i], ['Thumbtack', /thumbtack/i]
    ]
  };
})(globalThis);

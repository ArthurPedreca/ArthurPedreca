// Edit this file to change what the profile says. The workflow rebuilds the images from it.
export default {
  user: 'ArthurPedreca',
  name: 'Arthur Pedreca',
  timezone: 'America/Sao_Paulo',
  site: 'https://arthurpedreca.github.io/Portfolio/',
  upwork: 'https://www.upwork.com/freelancers/~01f52910ffb0d32b70',

  // Flip to false when you're fully booked. The banner turns amber.
  available: true,
  availableNote: 'Available for new projects',
  busyNote: 'Fully booked, new projects from next month',

  services: [
    { name: 'Security audits', detail: 'Supabase, RLS, exposed keys', note: 'from $99', status: 'Accepting projects' },
    { name: 'Production rescue', detail: 'apps built with AI tools', note: 'from $79', status: 'Accepting projects' },
    { name: 'AI chatbots & agents', detail: 'Claude, OpenAI, tool calling', note: 'from $119', status: 'Accepting projects' },
    { name: 'Flexiestays', detail: 'lead developer since 2025', note: 'UK', status: 'In production' },
    { name: 'Aisbar', detail: 'shift handoffs for ICU teams', note: 'BR', status: 'In development' },
  ],

  // kind: 'incident' shows RESOLVED, kind: 'release' shows SHIPPED.
  // Each entry links to <site>/history/<slug>.html
  incidents: [
    {
      slug: 'open-database',
      kind: 'incident',
      date: 'Oct 2026',
      title: 'Client records readable with the public key',
      summary: 'A 60,000-line booking platform built with an AI tool. Five critical exposures found and closed before launch.',
    },
    {
      slug: 'foxie',
      kind: 'release',
      date: '2026',
      title: 'Foxie, an AI concierge for Flexiestays',
      summary: 'Guests ask in plain English and get answers with live property cards, apartment photos and quick actions right inside the chat.',
    },
  ],
};

// Edit this file to change what the profile says. The workflow redraws the terminal and the README from it.
export default {
  user: 'ArthurPedreca',
  name: 'Arthur Pedreca',
  handle: 'arthur', // what `whoami` prints
  timezone: 'America/Sao_Paulo',
  workTimezone: 'Europe/London', // where Flexiestays is
  site: 'https://arthurpedreca.github.io/Portfolio/',
  upwork: 'https://www.upwork.com/freelancers/~01f52910ffb0d32b70',

  // The portfolio reads these through data/status.json.
  available: true,
  availableNote: 'Taking new projects',
  busyNote: 'Fully booked for now. New projects from next month.',

  // Under the name, in the terminal. Says who and what, plainly.
  sentence: 'Full-stack developer in São Paulo. I lead development at Flexiestays, serviced apartments in Bournemouth, UK.',

  // `cat now.txt`: what I'm working on, one entry per project.
  now: [
    ['flexiestays', 'lead developer since Jan 2025: the Nuxt site, the Flutter app, the dashboards and Foxie, the AI agent guests talk to'],
    ['aisbar', 'shift handover for ICU doctors in Brazil, in development'],
  ],

  // README, under the terminal.
  work: [
    {
      name: 'Flexiestays',
      url: 'https://flexiestays.com',
      text: 'Serviced apartments in Bournemouth, UK. I lead development: the Nuxt website, the Flutter app, the internal dashboards, and Foxie, the AI agent guests talk to, built on the Vercel AI SDK.',
    },
    {
      name: 'Aisbar',
      text: 'A shift-handover tool for ICU doctors in Brazil. In development, closed source for now.',
    },
  ],
  repos: [
    ['flexiestays-info', 'The Bournemouth Guide: an SEO-first static site in Astro whose pages an automation pipeline can write.'],
    ['cp-forzy-governan-a', 'A FastAPI sensor API that logs every call for observability, with a Streamlit client. Built with a FIAP team.'],
    ['desafio_crewAI', 'A multi-agent editorial assistant on CrewAI.'],
    ['ArthurPedreca', 'This page. A cron redraws it from my contribution calendar every six hours.'],
  ],
  stack: ['Laravel', 'Nuxt', 'Next.js', 'React', 'Flutter', 'Python'],
};

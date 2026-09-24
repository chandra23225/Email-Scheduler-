import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Database,
  Gauge,
  Layers3,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

const featureCards = [
  {
    icon: Mail,
    title: 'Bulk campaign orchestration',
    description: 'Schedule large delivery runs with controlled timing, delays, and recipient validation.',
  },
  {
    icon: ShieldCheck,
    title: 'Reliable dispatch logic',
    description: 'Protect against duplicate sends and recover gracefully from worker restarts and retries.',
  },
  {
    icon: Gauge,
    title: 'Rate-limit enforcement',
    description: 'Use Redis-backed counters to prevent sender abuse and keep delivery behavior predictable.',
  },
  {
    icon: BellRing,
    title: 'Operational visibility',
    description: 'Monitor queue health, job state, and alerting via Slack for production-level awareness.',
  },
];

const stack = ['Next.js 15', 'Express', 'TypeScript', 'PostgreSQL', 'Redis', 'BullMQ', 'Elasticsearch'];

const projectStats = [
  { label: 'Workflow', value: 'End-to-end' },
  { label: 'Queueing', value: 'BullMQ + Redis' },
  { label: 'Delivery', value: 'Async jobs' },
  { label: 'Reliability', value: 'Retry + dedupe' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7faf7] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-slate-200 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
              R
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">ReachInbox Scheduler</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Portfolio project</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-700 transition hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500"
            >
              Launch demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid gap-8 pb-16 pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Full-stack systems project
            </div>

            <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-900 md:text-6xl">
              Reliable outbound email at scale.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              A production-style scheduler for bulk campaigns, built with async job processing, delivery controls,
              and operational monitoring that mirrors real SaaS workflow constraints.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                View app demo <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-300"
              >
                GitHub repo
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              {stack.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-200">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">System overview</p>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                Live flow
              </span>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                  <Layers3 className="h-4 w-4 text-emerald-400" />
                  Scheduling layer
                </div>
                <p className="text-xl font-semibold">Campaign created, jobs queued, timestamps assigned</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Worker pipeline
                </div>
                <p className="text-xl font-semibold">Idempotency → rate limit → send → persist → index</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                  <Database className="h-4 w-4 text-cyan-400" />
                  Data layer
                </div>
                <p className="text-xl font-semibold">Postgres as source of truth, Redis for queue + rate limits</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 pb-10 md:grid-cols-4">
          {projectStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{stat.value}</p>
            </div>
          ))}
        </section>

        <section className="pb-20">
          <div className="mb-8 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">Why this project stands out</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Built for reliability, not just demo flow.</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-emerald-700">Project goal</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">A realistic SaaS-style workflow challenge.</h3>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              Explore the app <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              'Google auth and protected dashboard access',
              'Queue-driven email dispatch with scheduling controls',
              'Job reliability patterns for real-world production scenarios',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

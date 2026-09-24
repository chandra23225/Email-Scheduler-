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
    title: 'Campaign drafting',
    description: 'Build outbound sends with a cleaner authoring flow and better control over timing and recipients.',
  },
  {
    icon: ShieldCheck,
    title: 'Reliable sending logic',
    description: 'Prevent duplicates, protect your queue, and recover cleanly from retries or restarts.',
  },
  {
    icon: Gauge,
    title: 'Built for throughput',
    description: 'Keep the flow responsive with Redis-backed checks that stay lightweight under real pacing.',
  },
  {
    icon: BellRing,
    title: 'Operational awareness',
    description: 'Track delivery health and queue status without losing the focus on your personal workflow.',
  },
];

const stack = ['Next.js 15', 'Express', 'TypeScript', 'PostgreSQL', 'Redis', 'BullMQ', 'Elasticsearch'];

const projectStats = [
  { label: 'Workflow', value: 'Personal' },
  { label: 'Queueing', value: 'BullMQ + Redis' },
  { label: 'Delivery', value: 'Async jobs' },
  { label: 'Reliability', value: 'Retry + dedupe' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 shadow-[0_0_30px_rgba(99,102,241,0.12)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg font-bold text-white shadow-lg shadow-violet-900/30">
              O
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">Outbox</p>
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">personal workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-300 transition hover:text-white">
              Sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/25 transition hover:brightness-110"
            >
              Launch app <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid gap-8 pb-16 pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              personal outbound system
            </div>

            <h1 className="max-w-xl text-4xl font-black tracking-tight text-white md:text-6xl">
              Send with more control. Ship less chaos.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Outbox is my personal version of a serious outbound email workflow — cleaner, darker, and built around the
              systems I actually care about: timing, queue health, rate limits, and reliable sends.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-white"
              >
                Open workspace <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-violet-400/40 hover:text-white"
              >
                GitHub repo
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              {stack.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.8)]">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Live flow</p>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">
                healthy
              </span>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                  <Layers3 className="h-4 w-4 text-cyan-400" />
                  Scheduling layer
                </div>
                <p className="text-lg font-semibold text-white">Queue new campaigns with timing and pacing controls.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Worker pipeline
                </div>
                <p className="text-lg font-semibold text-white">Idempotency → rate-limit → send → sync delivery state</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                  <Database className="h-4 w-4 text-violet-400" />
                  Data layer
                </div>
                <p className="text-lg font-semibold text-white">PG stays authoritative while Redis handles speed and recovery.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 pb-10 md:grid-cols-4">
          {projectStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.35)]">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
              <p className="mt-3 text-2xl font-bold tracking-tight text-white">{stat.value}</p>
            </div>
          ))}
        </section>

        <section className="pb-20">
          <div className="mb-8 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-300">Why it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">A better personal workflow, not a copied template.</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.35)]">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.5)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-violet-300">Project goal</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">A realistic outbound workflow with my own identity.</h3>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 self-start rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/25 transition hover:brightness-110"
            >
              Explore the app <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              'Google auth and protected dashboard access',
              'Queue-driven email dispatch with scheduling controls',
              'Production-minded patterns for personal automation workflows',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                <p className="text-sm leading-6 text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

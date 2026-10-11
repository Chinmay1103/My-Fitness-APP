import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DayPanel } from './components/DayPanel';
import { Segmented } from './components/ui';
import { fetchDataset, type Dataset } from './lib/data';
import { demoDataset } from './lib/demo';
import { addDays, today } from './lib/dates';
import { formatDate, formatNumber } from './lib/format';
import { buildRows, METRIC_ORDER, METRICS, type MetricKey } from './lib/metrics';
import { loadPreset, PRESETS, presetRange, savePreset, type DateRange, type Preset } from './lib/range';
import { previousRange } from './lib/stats';
import { supabase } from './lib/supabase';
import { Body } from './pages/Body';
import { Habits } from './pages/Habits';
import { Overview } from './pages/Overview';
import { Progress } from './pages/Progress';
import { Reports } from './pages/Reports';
import { SignIn } from './pages/SignIn';
import { Sleep } from './pages/Sleep';
import { Training } from './pages/Training';
import { Trends } from './pages/Trends';

type PageKey = 'overview' | 'progress' | 'trends' | 'sleep' | 'training' | 'body' | 'habits' | 'reports';

const PAGES: { key: PageKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'progress', label: 'Progress' },
  { key: 'trends', label: 'Trends' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'training', label: 'Training' },
  { key: 'body', label: 'Body & food' },
  { key: 'habits', label: 'Habits' },
  { key: 'reports', label: 'Reports' },
];

interface Route {
  page: PageKey;
  metric: MetricKey;
  day: string | null;
}

/** Routes live in the hash (#/trends/hrv?day=2026-10-01) so links work on GitHub Pages and can be shared or bookmarked. */
function parseHash(): Route {
  const [path = '', query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const [page, metric] = path.split('/');
  const day = new URLSearchParams(query).get('day');
  return {
    page: PAGES.some((p) => p.key === page) ? (page as PageKey) : 'overview',
    metric: METRIC_ORDER.includes(metric as MetricKey) ? (metric as MetricKey) : 'recovery',
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
  };
}

function toHash(r: Route): string {
  return `#/${r.page}${r.page === 'trends' ? `/${r.metric}` : ''}${r.day ? `?day=${r.day}` : ''}`;
}

type Theme = 'system' | 'light' | 'dark';

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('myfitness.theme') as Theme) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('myfitness.theme', theme);
    } catch {
      // Not remembered in a private window; fine.
    }
  }, [theme]);
  return [theme, setTheme];
}

/** The browser's "install this site as an app" prompt, when it offers one (Chrome, Edge, Android). */
function useInstallPrompt() {
  const [prompt, setPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Event & { prompt: () => Promise<void> });
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return prompt ? () => prompt.prompt().finally(() => setPrompt(null)) : null;
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [demo, setDemo] = useState(false);
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(parseHash);
  const [preset, setPreset] = useState<Preset>(loadPreset);
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [theme, setTheme] = useTheme();
  const install = useInstallPrompt();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: Partial<Route>) => {
    const r = { ...parseHash(), ...next };
    window.location.hash = toHash(r);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(demo ? demoDataset() : await fetchDataset());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [demo]);

  const userId = session?.user.id;
  useEffect(() => {
    if (demo || userId) load();
    else setData(null);
  }, [demo, userId, load]);

  const now = today(data?.timeZone);
  const first = data?.days[0]?.date ?? addDays(now, -29);
  const range: DateRange = useMemo(() => {
    if (preset === 'custom' && custom) return { preset, ...custom };
    return presetRange(preset === 'custom' ? '90d' : preset, now, first);
  }, [preset, custom, now, first]);

  const rows = useMemo(() => (data ? buildRows(data, range.from, range.to) : []), [data, range]);
  const prevRows = useMemo(() => {
    if (!data) return [];
    const p = previousRange(range.from, range.to);
    return buildRows(data, p.from, p.to);
  }, [data, range]);

  if (session === undefined) return <div className="splash" aria-busy="true" />;
  if (!session && !demo) return <SignIn onDemo={() => setDemo(true)} />;

  const pickPreset = (p: Preset) => {
    setPreset(p);
    if (p === 'custom') setCustom((c) => c ?? { from: range.from, to: range.to });
    else savePreset(p);
  };

  const pageProps = {
    data: data!,
    rows,
    prevRows,
    openDay: (d: string) => navigate({ day: d }),
    openTrend: (k: MetricKey) => navigate({ page: 'trends', metric: k }),
  };

  const synced = data?.days.length ?? 0;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/overview">
          <img src="./icon-192.png" alt="" width={28} height={28} />
          My Fitness
        </a>
        <nav className="nav" aria-label="Pages">
          {PAGES.map((p) => (
            <a key={p.key} href={toHash({ page: p.key, metric: route.metric, day: null })} aria-current={route.page === p.key ? 'page' : undefined}>
              {p.label}
            </a>
          ))}
        </nav>
        <div className="account">
          {install ? (
            <button type="button" className="button small" onClick={install}>
              Install app
            </button>
          ) : null}
          <select aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="small-select">
            <option value="system">System theme</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          {demo ? (
            <button type="button" className="button small" onClick={() => setDemo(false)}>
              Exit demo
            </button>
          ) : (
            <button type="button" className="button small" onClick={() => supabase.auth.signOut()} title={session?.user.email ?? undefined}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="content">
        {demo ? <p className="banner">Demo data: a made-up year, scored by the real app math. Nothing here is yours.</p> : null}

        <div className="filters no-print">
          <Segmented label="Date range" value={preset} onChange={pickPreset} options={PRESETS} />
          {preset === 'custom' && custom ? (
            <span className="custom-range">
              <input type="date" aria-label="From" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
              <span className="muted">to</span>
              <input type="date" aria-label="To" value={custom.to} min={custom.from} max={now} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
            </span>
          ) : null}
          <button type="button" className="button small" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="page-head">
          <h1>
            {route.page === 'trends' ? METRICS[route.metric].label : PAGES.find((p) => p.key === route.page)!.label}
          </h1>
          <p className="muted small">
            {formatDate(range.from)} – {formatDate(range.to)}
            {data && !demo ? ` · ${formatNumber(synced)} days in the cloud${synced ? ` since ${formatDate(data.days[0]!.date)}` : ''}` : ''}
          </p>
        </div>

        {route.page === 'trends' ? (
          <div className="chips no-print" role="tablist" aria-label="Metric">
            {METRIC_ORDER.map((k) => (
              <a key={k} href={toHash({ page: 'trends', metric: k, day: null })} className={route.metric === k ? 'chip on' : 'chip'} role="tab" aria-selected={route.metric === k}>
                {METRICS[k].label}
              </a>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="error" role="alert">
            Couldn't load your data: {error}
          </p>
        ) : null}

        {!data ? (
          <p className="muted">{loading ? 'Loading your history…' : ''}</p>
        ) : synced === 0 ? (
          <div className="card">
            <h2>Nothing synced yet</h2>
            <p className="muted">
              The website shows what the phone app uploads after each refresh while you're signed in (demo data never leaves the phone). Open My
              Fitness on the phone, sign in on the Account screen with this same email, and pull to refresh. Then press Refresh here.
            </p>
          </div>
        ) : (
          <div className={loading ? 'page loading' : 'page'}>
            {route.page === 'overview' ? <Overview {...pageProps} /> : null}
            {route.page === 'progress' ? <Progress {...pageProps} /> : null}
            {route.page === 'trends' ? <Trends {...pageProps} metric={route.metric} setMetric={(k) => navigate({ metric: k })} /> : null}
            {route.page === 'sleep' ? <Sleep {...pageProps} /> : null}
            {route.page === 'training' ? <Training {...pageProps} /> : null}
            {route.page === 'body' ? <Body {...pageProps} /> : null}
            {route.page === 'habits' ? <Habits {...pageProps} /> : null}
            {route.page === 'reports' ? <Reports {...pageProps} /> : null}
          </div>
        )}
        <footer className="footer muted small">Wellness guidance, not medical advice. Scores are computed on your phone; this site only shows them.</footer>
      </main>

      {data && route.day ? <DayPanel data={data} date={route.day} onClose={() => navigate({ day: null })} onPick={(d) => navigate({ day: d })} /> : null}
    </div>
  );
}

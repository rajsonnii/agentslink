'use client';

import React, { useState, useEffect } from 'react';
import type { Incident, IncidentStatus } from '@slink/shared';

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PR_OPENED' | 'RECOVERED'>('ALL');
  const [isHealing, setIsHealing] = useState(false);
  const [healFeedback, setHealFeedback] = useState<string | null>(null);

  // Fetch incidents from API backend
  const fetchIncidents = async () => {
    try {
      const res = await fetch('/api/incidents');
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
      }
    } catch {
      // Fallback sample data if API is loading or offline
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerHeal = async (incidentId: string) => {
    setIsHealing(true);
    setHealFeedback(null);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/heal`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setHealFeedback('Fix verified in isolated sandbox & PR created!');
        fetchIncidents();
        if (data.incident) {
          setSelectedIncident(data.incident);
        }
      } else {
        setHealFeedback('Investigation report generated (tests failed in sandbox).');
      }
    } catch {
      setHealFeedback('Error triggering repair agent.');
    } finally {
      setIsHealing(false);
    }
  };

  const filtered = incidents.filter((inc) => {
    if (filter === 'ACTIVE') return inc.status === 'OPEN' || inc.status === 'DIAGNOSING' || inc.status === 'PATCHING' || inc.status === 'VERIFYING';
    if (filter === 'PR_OPENED') return inc.status === 'PR_OPENED';
    if (filter === 'RECOVERED') return inc.status === 'RECOVERED';
    return true;
  });

  const activeCount = incidents.filter((i) => i.status === 'OPEN' || i.status === 'DIAGNOSING' || i.status === 'PATCHING' || i.status === 'VERIFYING').length;
  const recoveredCount = incidents.filter((i) => i.status === 'RECOVERED').length;
  const prCount = incidents.filter((i) => i.status === 'PR_OPENED').length;

  return (
    <div className="space-y-8">
      {/* Top Banner & Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-5 shadow-lg backdrop-blur">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400">Active Incidents</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400">{activeCount}</span>
            <span className="text-xs text-gray-400">requiring attention</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-5 shadow-lg backdrop-blur">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400">PRs Waiting Merge</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-400">{prCount}</span>
            <span className="text-xs text-emerald-400">sandbox verified</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-5 shadow-lg backdrop-blur">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400">Restored Services</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">{recoveredCount}</span>
            <span className="text-xs text-emerald-400">gecko healed</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-5 shadow-lg backdrop-blur">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400">Autonomous Healing</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">99.2%</span>
            <span className="text-xs text-emerald-400">uptime guard</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Incidents & Live Stream */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Incidents List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Incident Radar</span>
              <span className="rounded-md bg-gray-800 px-2 py-0.5 text-xs font-normal text-gray-300">
                {filtered.length} total
              </span>
            </h2>

            {/* Filter Tabs */}
            <div className="flex rounded-lg border border-gray-800 bg-gray-900/80 p-1 text-xs">
              {(['ALL', 'ACTIVE', 'PR_OPENED', 'RECOVERED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`rounded-md px-3 py-1 font-medium transition-all ${
                    filter === tab
                      ? 'bg-emerald-500 text-black shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-800 bg-[#111827]/40 p-12 text-center">
              <span className="text-4xl">🦎</span>
              <h3 className="mt-3 text-sm font-semibold text-white">All systems healthy</h3>
              <p className="mt-1 text-xs text-gray-400">
                Agent Slink is watching your apps via CLI wrapper and synthetic browser pings.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`group relative cursor-pointer rounded-xl border p-4 transition-all hover:border-emerald-500/50 hover:shadow-lg ${
                    selectedIncident?.id === inc.id
                      ? 'border-emerald-500 bg-gray-900/90 ring-1 ring-emerald-500'
                      : 'border-gray-800/80 bg-[#111827]/80 hover:bg-[#111827]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-gray-400">
                          {inc.projectId}
                        </span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs font-mono text-gray-500">
                          {inc.fingerprint.slice(0, 8)}
                        </span>
                        {inc.occurrenceCount > 1 && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                            {inc.occurrenceCount}x
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        {inc.title}
                      </h4>
                      <p className="line-clamp-1 text-xs text-gray-400">
                        {inc.errorSummary}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={inc.status} />
                      <span className="text-[10px] text-gray-500">
                        {new Date(inc.lastSeenAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Incident Detail / Inspector */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-white">Diagnostics & Repair</h2>

          {selectedIncident ? (
            <div className="rounded-2xl border border-gray-800 bg-[#111827] p-5 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <div>
                  <span className="text-xs font-mono text-gray-400">{selectedIncident.id}</span>
                  <h3 className="text-base font-bold text-white mt-0.5">{selectedIncident.title}</h3>
                </div>
                <StatusBadge status={selectedIncident.status} />
              </div>

              {/* Action Button */}
              {selectedIncident.status !== 'RECOVERED' && (
                <div>
                  <button
                    disabled={isHealing}
                    onClick={() => handleTriggerHeal(selectedIncident.id)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {isHealing ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                        <span>Diagnosing & Testing Patch in Sandbox...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Auto-Heal with Agent Slink</span>
                      </>
                    )}
                  </button>
                  {healFeedback && (
                    <div className="mt-2 text-center text-xs font-medium text-emerald-400">
                      {healFeedback}
                    </div>
                  )}
                </div>
              )}

              {/* Root Cause Analysis (RCA) */}
              {selectedIncident.diagnosis && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <span>🧠</span>
                    <span>AI Root Cause Analysis</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {selectedIncident.diagnosis.rootCause}
                  </p>
                  <p className="text-xs text-gray-400 italic">
                    Fix: {selectedIncident.diagnosis.proposedFix}
                  </p>
                </div>
              )}

              {/* Pull Request Card */}
              {selectedIncident.pullRequest && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <span>🐙</span>
                      <span>GitHub Pull Request #{selectedIncident.pullRequest.number}</span>
                    </span>
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                      {selectedIncident.pullRequest.branch}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 line-clamp-2">
                    {selectedIncident.pullRequest.title}
                  </p>
                  <a
                    href={selectedIncident.pullRequest.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    View Pull Request on GitHub &rarr;
                  </a>
                </div>
              )}

              {/* Sandbox Verification Output */}
              {selectedIncident.verification && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
                    <span>Isolated Sandbox Verification</span>
                    <span className={selectedIncident.verification.passed ? 'text-emerald-400' : 'text-red-400'}>
                      {selectedIncident.verification.passed ? '✅ PASSED' : '❌ FAILED'} ({selectedIncident.verification.durationMs}ms)
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-lg bg-black/60 p-3 font-mono text-[11px] text-gray-300 border border-gray-800">
                    <pre className="whitespace-pre-wrap">{selectedIncident.verification.stdout || selectedIncident.verification.stderr || 'Tests completed cleanly.'}</pre>
                  </div>
                </div>
              )}

              {/* Stack Trace */}
              {selectedIncident.stackTrace && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-gray-400">Stack Trace</div>
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-black/60 p-3 font-mono text-[11px] text-red-300/90 border border-gray-800">
                    <pre className="whitespace-pre-wrap">{selectedIncident.stackTrace}</pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-[#111827]/40 p-8 text-center text-gray-500">
              <span className="text-3xl mb-2">👈</span>
              <p className="text-xs">Select an incident from the radar to inspect logs, root cause analysis, and trigger auto-repair.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  const styles: Record<IncidentStatus, { bg: string; text: string; label: string }> = {
    OPEN: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', label: 'Open' },
    DIAGNOSING: { bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400', label: 'Diagnosing' },
    PATCHING: { bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400', label: 'Patching' },
    VERIFYING: { bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400', label: 'Sandbox Testing' },
    PR_OPENED: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', label: 'PR Ready' },
    REPORTED: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', label: 'Reported' },
    RECOVERED: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: 'Recovered' },
    CLOSED: { bg: 'bg-gray-500/10 border-gray-500/30', text: 'text-gray-400', label: 'Closed' },
  };

  const style = styles[status] || styles.OPEN;

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

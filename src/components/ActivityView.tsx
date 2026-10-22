import React, { useState } from 'react';
import { Activity, ShieldCheck, UserCheck, XCircle, RotateCcw, Search, Terminal } from 'lucide-react';
import { CaseEvent } from '../types.ts';

interface ActivityViewProps {
  events: CaseEvent[];
  loading: boolean;
  onRefresh: () => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ events, loading, onRefresh }) => {
  const [filter, setFilter] = useState<string>('all');

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true;
    return e.eventType === filter;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'case_prepared':
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      case 'user_approved':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'user_rejected':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'status_queried':
        return <Search className="w-4 h-4 text-amber-400" />;
      case 'system_reset':
        return <RotateCcw className="w-4 h-4 text-purple-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">System & Case Activity History</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit logging of verified agent tool operations, case preparations, and explicit customer approvals
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Event Types</option>
            <option value="case_prepared">Case Prepared</option>
            <option value="user_approved">User Approved</option>
            <option value="user_rejected">User Rejected</option>
            <option value="status_queried">Status Queried</option>
            <option value="system_reset">System Reset</option>
          </select>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading activity events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">No Activity Events Logged</h3>
          <p className="text-xs text-slate-500 mt-1">Interact with the Alexa+ agent to record case events.</p>
        </div>
      ) : (
        <div className="relative border-l border-slate-800 ml-4 sm:ml-6 pl-6 space-y-6">
          {filteredEvents.map(evt => {
            return (
              <div key={evt.id} className="relative group">
                {/* Timeline node icon */}
                <div className="absolute -left-[35px] top-1 w-7 h-7 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                  {getEventIcon(evt.eventType)}
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white uppercase tracking-wider text-[11px]">
                        {evt.eventType.replace('_', ' ')}
                      </span>
                      {evt.caseId && evt.caseId !== 'SYSTEM' && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="font-mono text-cyan-400 font-medium">{evt.caseId}</span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400 capitalize">Actor: {evt.actor}</span>
                    </div>

                    <span className="text-slate-400 font-mono text-[11px] tabular-nums">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200">{evt.summary}</p>

                  {evt.metadataJson && evt.metadataJson !== '{}' && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80">
                      <pre className="text-[10px] font-mono text-slate-400 bg-slate-950 p-2 rounded overflow-x-auto">
                        {evt.metadataJson}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

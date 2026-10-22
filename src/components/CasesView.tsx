import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Clock, FileText, Check, X, History } from 'lucide-react';
import { CaseRecord, CaseEvent } from '../types.ts';
import { approveCaseAction, rejectCaseAction, fetchCaseEvents } from '../api.ts';

interface CasesViewProps {
  cases: CaseRecord[];
  onRefresh: () => void;
  loading: boolean;
}

export const CasesView: React.FC<CasesViewProps> = ({ cases, onRefresh, loading }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [activeModalCase, setActiveModalCase] = useState<CaseRecord | null>(null);
  const [modalEvents, setModalEvents] = useState<CaseEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filteredCases = cases.filter(c => {
    if (filter === 'pending') return c.status === 'pending_approval';
    if (filter === 'approved') return c.status === 'approved';
    if (filter === 'rejected') return c.status === 'rejected';
    return true;
  });

  const handleOpenModal = async (c: CaseRecord) => {
    setActiveModalCase(c);
    setEventsLoading(true);
    try {
      const events = await fetchCaseEvents(c.id);
      setModalEvents(events);
    } catch {
      setModalEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleApprove = async (caseId: string) => {
    try {
      setActionLoadingId(caseId);
      setActionFeedback(null);
      await approveCaseAction(caseId, 'User approved from Cases dashboard');
      setActionFeedback({ type: 'success', message: `Case ${caseId} successfully approved and RMA generated!` });
      onRefresh();
    } catch (err: unknown) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Approval failed' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (caseId: string) => {
    try {
      setActionLoadingId(caseId);
      setActionFeedback(null);
      await rejectCaseAction(caseId, 'User rejected from Cases dashboard');
      setActionFeedback({ type: 'success', message: `Case ${caseId} has been marked as rejected.` });
      onRefresh();
    } catch (err: unknown) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Rejection failed' });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Title & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Resolution Cases</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Prepared return authorizations, warranty replacements, and recorded customer approvals
          </p>
        </div>

        {/* Status Filter Tabs (Button Segmented Controls) */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                filter === tab
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'all' ? 'All Cases' : tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`mb-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/70 border-rose-800 text-rose-200'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          Loading cases from database...
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">No Cases In This View</h3>
          <p className="text-xs text-slate-500 mt-1">
            {filter === 'all'
              ? 'Ask the Alexa+ Assistant to prepare a return or warranty claim for one of your orders.'
              : `There are currently no cases matching the '${filter}' filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCases.map(c => {
            const isPending = c.status === 'pending_approval';
            const isApproved = c.status === 'approved';
            const isRejected = c.status === 'rejected';

            return (
              <div
                key={c.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Info */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-cyan-400 font-bold">{c.id}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-300 font-medium capitalize">
                        {c.caseType.replace('_', ' ')}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400 font-mono">Order {c.orderId}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400 tabular-nums">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white">
                      {c.order?.productName || 'Simulated Product'}
                    </h3>

                    <p className="text-xs text-slate-300 line-clamp-2">
                      <strong className="text-slate-400 font-medium">Issue: </strong>
                      {c.issueDescription}
                    </p>

                    <div className="text-xs text-slate-400 pt-1">
                      <strong className="text-slate-400 font-medium">Policy Reason: </strong>
                      <span>{c.policyReason}</span>
                    </div>
                  </div>

                  {/* Right Status & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
                    {/* Status Badge */}
                    {isPending && (
                      <span className="px-3 py-1 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Pending User Approval
                      </span>
                    )}
                    {isApproved && (
                      <span className="px-3 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-3 py-1 text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> Rejected
                      </span>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleReject(c.id)}
                            disabled={actionLoadingId === c.id}
                            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5 text-rose-400" />
                            <span>Reject</span>
                          </button>
                          <button
                            onClick={() => handleApprove(c.id)}
                            disabled={actionLoadingId === c.id}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Approve</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleOpenModal(c)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Audit Trail</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Audit Trail Modal */}
      {activeModalCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Case Audit Trail</span>
                  <span className="font-mono text-cyan-400 text-sm font-semibold">{activeModalCase.id}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Order {activeModalCase.orderId} · {activeModalCase.order?.productName}
                </p>
              </div>
              <button
                onClick={() => setActiveModalCase(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Proposed Action:</span>
                  <span className="text-slate-200">{activeModalCase.proposedAction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Resolution Details:</span>
                  <span className="text-cyan-300 font-mono">{activeModalCase.resolutionDetails}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Timeline Events ({modalEvents.length})
                </h4>

                {eventsLoading ? (
                  <div className="py-4 text-center text-xs text-slate-400">Loading events...</div>
                ) : modalEvents.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-500">No events logged for this case.</div>
                ) : (
                  <div className="space-y-2">
                    {modalEvents.map(evt => (
                      <div
                        key={evt.id}
                        className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-cyan-400 uppercase tracking-wider">
                            {evt.eventType.replace('_', ' ')}
                          </span>
                          <span className="font-mono tabular-nums">
                            {new Date(evt.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-200">{evt.summary}</p>
                        <div className="text-[10px] text-slate-400">Actor: {evt.actor}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveModalCase(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

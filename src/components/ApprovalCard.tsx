import React, { useState } from 'react';
import { ShieldAlert, Check, X, CheckCircle, XCircle } from 'lucide-react';
import { PendingApprovalData, CaseRecord } from '../types.ts';
import { approveCaseAction, rejectCaseAction } from '../api.ts';

interface ApprovalCardProps {
  data: PendingApprovalData;
  onResolved?: (updatedCase: CaseRecord, decision: 'approved' | 'rejected') => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({ data, onResolved }) => {
  const [loading, setLoading] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [resolvedCase, setResolvedCase] = useState<CaseRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApprove = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await approveCaseAction(data.caseId, 'User approved via inline Alexa+ card');
      setResolvedStatus('approved');
      setResolvedCase(res.case);
      if (onResolved) onResolved(res.case, 'approved');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await rejectCaseAction(data.caseId, 'User rejected via inline Alexa+ card');
      setResolvedStatus('rejected');
      setResolvedCase(res.case);
      if (onResolved) onResolved(res.case, 'rejected');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-500/40 bg-gradient-to-br from-slate-900 to-amber-950/20 p-4 shadow-lg text-slate-100">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-white tracking-tight">
              Action Authorization Required
            </h4>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span className="font-mono text-cyan-400 font-semibold">{data.caseId}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{data.caseType.replace('_', ' ')}</span>
              <span aria-hidden="true">·</span>
              <span>Order {data.orderId}</span>
            </div>
          </div>
        </div>

        {resolvedStatus === 'pending' && (
          <span className="px-2.5 py-1 text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-md">
            Pending User Approval
          </span>
        )}
        {resolvedStatus === 'approved' && (
          <span className="px-2.5 py-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Approved
          </span>
        )}
        {resolvedStatus === 'rejected' && (
          <span className="px-2.5 py-1 text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-md flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        )}
      </div>

      {/* Body Details */}
      <div className="py-3 space-y-2.5 text-xs">
        <div>
          <span className="text-slate-400 block mb-0.5 font-medium">Product & Issue</span>
          <p className="text-slate-200">
            <strong className="text-white">{data.productName}</strong>: {data.issueDescription}
          </p>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1.5">
          <div className="flex items-start gap-1.5">
            <span className="text-slate-400 shrink-0 font-medium">Proposed Action:</span>
            <span className="text-cyan-300 font-medium">{data.proposedAction}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-slate-400 shrink-0 font-medium">Verified Policy:</span>
            <span className="text-slate-300">{data.policyReason}</span>
          </div>
        </div>

        {resolvedCase && (
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 space-y-1">
            <div className="text-[11px] font-medium text-slate-400">Resolution Status Recorded:</div>
            <p className="text-slate-200 text-xs font-mono">{resolvedCase.resolutionDetails}</p>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Action Footer */}
      {resolvedStatus === 'pending' ? (
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-3">
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Reject Request</span>
          </button>

          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{loading ? 'Authorizing...' : 'Approve & Issue RMA'}</span>
          </button>
        </div>
      ) : (
        <div className="pt-2 text-center text-xs text-slate-400">
          This simulated case has been finalized in the backend database.
        </div>
      )}
    </div>
  );
};

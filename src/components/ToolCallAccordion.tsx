import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';
import { ToolCallRecord } from '../types.ts';

interface ToolCallAccordionProps {
  toolCalls: ToolCallRecord[];
}

export const ToolCallAccordion: React.FC<ToolCallAccordionProps> = ({ toolCalls }) => {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  if (!toolCalls || toolCalls.length === 0) return null;

  const toggleOpen = (id: string) => {
    setOpenIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getToolIcon = (name: string) => {
    switch (name) {
      case 'find_order':
        return '🔍';
      case 'check_eligibility':
        return '⚖️';
      case 'create_case':
        return '📋';
      case 'get_case_status':
        return '🔎';
      default:
        return '⚡';
    }
  };

  const getToolFriendlyName = (name: string) => {
    switch (name) {
      case 'find_order':
        return 'Find Simulated Order';
      case 'check_eligibility':
        return 'Evaluate Return & Warranty Policy';
      case 'create_case':
        return 'Prepare Resolution Case (Pending Approval)';
      case 'get_case_status':
        return 'Query Live Case Record & History';
      case 'list_orders':
        return 'Fetch Account Orders';
      case 'list_cases':
        return 'Fetch Saved Cases';
      default:
        return name;
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-slate-700/60 pt-3">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
        <span>Agentic Tool Traces ({toolCalls.length} verified executions)</span>
      </div>

      <div className="space-y-1.5">
        {toolCalls.map((tc, idx) => {
          const itemKey = tc.id || `tc_${idx}`;
          const isOpen = openIds[itemKey] || false;
          const hasError = Boolean(tc.output && (tc.output as Record<string, unknown>).error);

          return (
            <div
              key={itemKey}
              className="text-xs rounded-lg border border-slate-700/70 bg-slate-900/60 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleOpen(itemKey)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-sm">{getToolIcon(tc.toolName)}</span>
                  <span className="font-semibold text-slate-200">{tc.toolName}</span>
                  <span className="text-slate-400 font-sans hidden sm:inline">· {getToolFriendlyName(tc.toolName)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] tabular-nums">
                  {hasError ? (
                    <span className="text-rose-400 flex items-center gap-1 font-sans">
                      <AlertCircle className="w-3 h-3" /> Error
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1 font-sans">
                      <CheckCircle2 className="w-3 h-3" /> Executed
                    </span>
                  )}
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-3 py-2.5 bg-slate-950/80 border-t border-slate-800 text-[11px] font-mono space-y-2">
                  <div>
                    <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1 font-sans">Inputs</div>
                    <pre className="bg-slate-900 p-2 rounded text-slate-300 overflow-x-auto">
                      {JSON.stringify(tc.input, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1 font-sans">Backend Verified Output</div>
                    <pre className="bg-slate-900 p-2 rounded text-cyan-200/90 overflow-x-auto">
                      {JSON.stringify(tc.output, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

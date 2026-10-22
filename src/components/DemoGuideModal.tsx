import React from 'react';
import { X, Play, CheckCircle2, AlertCircle, ArrowRight, BookOpen, Terminal, Sparkles } from 'lucide-react';

interface DemoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunScenario: (prompt: string, tab?: 'assistant' | 'orders' | 'cases' | 'activity') => void;
}

export const DemoGuideModal: React.FC<DemoGuideModalProps> = ({
  isOpen,
  onClose,
  onRunScenario,
}) => {
  if (!isOpen) return null;

  const scenarios = [
    {
      title: '1. Standard Return: Inside 30-Day Window (Headphones)',
      badge: 'Standard Return',
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      description:
        'Tests finding ORD-84920, verifying 30-day window (delivered 14 days ago on 2026-10-08), preparing pending return case, requiring user approval, and approving.',
      prompt: 'My headphones stopped working. Can you help me return them?',
      tab: 'assistant' as const,
    },
    {
      title: '2. Warranty Coverage: Return Window Closed (Coffee Maker)',
      badge: 'Warranty Replacement',
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      description:
        'Tests ORD-71932 delivered 100 days ago. 30-day return window is closed, but 1-year manufacturer warranty is active. Agent explains policy and prepares warranty replacement case.',
      prompt: 'My coffee maker stopped pumping water. Can I get warranty support?',
      tab: 'assistant' as const,
    },
    {
      title: '3. Ineligible Scenario: Both Windows Elapsed (Desk Fan)',
      badge: 'Negative Test',
      color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
      description:
        'Tests ORD-58210 delivered over a year ago. Return window (30d) and warranty (180d) are both expired. Agent safely explains ineligibility and rejects automated case creation.',
      prompt: 'I want to return the AeroBreeze desk fan that stopped spinning.',
      tab: 'assistant' as const,
    },
    {
      title: '4. Ambiguity Resolution: Multiple Similar Items (NordicTrail)',
      badge: 'Ambiguity Clarification',
      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      description:
        'User mentions "NordicTrail boots/shoes". Matches both Hiking Boots (ORD-93041) and Trail Shoes (ORD-93042). Agent recognizes ambiguity and asks user to specify.',
      prompt: 'I have an issue with my NordicTrail footwear and want to exchange it.',
      tab: 'assistant' as const,
    },
    {
      title: '5. Query Live Status of Created Case',
      badge: 'get_case_status Tool',
      color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      description:
        'Queries the real saved database record using get_case_status and verifies approval state and audit event count.',
      prompt: 'What is the status of CASE-2026-1001?',
      tab: 'assistant' as const,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                ReturnRelay — Interactive Scenario Guide
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Explore return, warranty, and ambiguity resolution workflows
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Overview Callout */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Multi-Step Agentic Architecture vs. Simple Chatbot</span>
            </h4>
            <p className="text-slate-300 leading-relaxed">
              ReturnRelay demonstrates a genuine multi-step agentic loop: it calls real backend tools (<code className="text-cyan-300">find_order</code>, <code className="text-cyan-300">check_eligibility</code>, <code className="text-cyan-300">create_case</code>, <code className="text-cyan-300">get_case_status</code>), grounds decisions on an application clock (<span className="font-mono text-cyan-400">2026-10-22</span>), requires deliberate human approval before saving consequential demo actions, and logs all events to an SQLite audit trail.
            </p>
          </div>

          {/* Quick Scenario Triggers */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Ready-to-Run Test Scenarios
            </h4>

            {scenarios.map((sc, idx) => (
              <div
                key={idx}
                className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${sc.color}`}>
                      {sc.badge}
                    </span>
                    <h5 className="font-semibold text-white">{sc.title}</h5>
                  </div>
                  <p className="text-slate-300">{sc.description}</p>
                  <div className="text-[11px] text-cyan-300/80 font-mono">
                    Prompt: &ldquo;{sc.prompt}&rdquo;
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onRunScenario(sc.prompt, sc.tab);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap self-start sm:self-center"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Scenario</span>
                </button>
              </div>
            ))}
          </div>

          {/* Hackathon Compliance Notes */}
          <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300 block">Simulation Notice:</span>
            <p>
              ReturnRelay simulates an Alexa+ customer experience inside a web app. It does not claim live Amazon retail or device integration. All orders, customer accounts, and return labels are simulated demonstration data.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Reference Clock: 2026-10-22 · Deterministic Dataset
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

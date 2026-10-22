/**
 * ReturnRelay — AI-Powered Conversational Product Return and Warranty Resolution Agent
 * Simulated Alexa+ Experience
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, X, AlertTriangle } from 'lucide-react';
import { Header } from './components/Header.tsx';
import { AssistantView } from './components/AssistantView.tsx';
import { OrdersView } from './components/OrdersView.tsx';
import { CasesView } from './components/CasesView.tsx';
import { ActivityView } from './components/ActivityView.tsx';
import { DemoGuideModal } from './components/DemoGuideModal.tsx';
import { Order, CaseRecord, CaseEvent, HealthInfo, AssistantCommand } from './types.ts';
import { fetchHealth, fetchOrders, fetchCases, fetchAllEvents, resetDemoData } from './api.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'assistant' | 'orders' | 'cases' | 'activity'>('assistant');
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);

  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [guideOpen, setGuideOpen] = useState(false);
  const [stagedCommand, setStagedCommand] = useState<AssistantCommand | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch (err) {
      console.warn('Failed to fetch health info:', err);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (err) {
      console.warn('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const data = await fetchCases();
      setCases(data);
    } catch (err) {
      console.warn('Failed to load cases:', err);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const data = await fetchAllEvents();
      setEvents(data);
    } catch (err) {
      console.warn('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
    loadOrders();
    loadCases();
    loadEvents();
  }, [loadHealth, loadOrders, loadCases, loadEvents]);

  // In-app modal reset handler (guaranteed to work in iframe sandboxes without window.confirm)
  const handleConfirmReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      await resetDemoData();
      await Promise.all([loadOrders(), loadCases(), loadEvents()]);
      setShowResetModal(false);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Reset operation failed');
    } finally {
      setResetting(false);
    }
  };

  const handleOrderSelect = (order: Order) => {
    setStagedCommand({
      text: `My ${order.productName} (${order.id}) has an issue. Can you help me return or repair it?`,
      autoSend: true,
      timestamp: Date.now(),
    });
    setActiveTab('assistant');
  };

  const handleRunScenario = (prompt: string, targetTab?: 'assistant' | 'orders' | 'cases' | 'activity') => {
    if (targetTab && targetTab !== 'assistant') {
      setActiveTab(targetTab);
    } else {
      setStagedCommand({
        text: prompt,
        autoSend: true,
        timestamp: Date.now(),
      });
      setActiveTab('assistant');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        onReset={() => setShowResetModal(true)}
        onOpenGuide={() => setGuideOpen(true)}
        resetting={resetting}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 overflow-x-hidden">
        {activeTab === 'assistant' && (
          <AssistantView
            command={stagedCommand}
            onClearCommand={() => setStagedCommand(null)}
            onCaseUpdated={() => {
              loadCases();
              loadEvents();
            }}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersView
            orders={orders}
            loading={loadingOrders}
            onSelectOrderForResolution={handleOrderSelect}
          />
        )}

        {activeTab === 'cases' && (
          <CasesView
            cases={cases}
            loading={loadingCases}
            onRefresh={() => {
              loadCases();
              loadEvents();
            }}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityView
            events={events}
            loading={loadingEvents}
            onRefresh={loadEvents}
          />
        )}
      </main>

      {/* Interactive Scenario Guide Modal */}
      <DemoGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        onRunScenario={handleRunScenario}
      />

      {/* In-App Reset Confirmation Modal (replaces browser confirm to avoid iframe sandbox blocking) */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Reset Demo Data?</h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will restore the 6 demonstration customer orders and clear all resolution cases and activity logs back to the deterministic initial state.
            </p>

            {resetError && (
              <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {resetError}
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmReset}
                disabled={resetting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                <span>{resetting ? 'Resetting...' : 'Confirm Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

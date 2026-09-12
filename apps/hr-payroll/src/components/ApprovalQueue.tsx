"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { supabase } from "@/lib/supabaseClient";

interface LeaveRequest {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  status: string;
  employee: { firstName: string; lastName: string; employeeCode: string };
}

interface ExpenseClaim {
  id: string;
  claimType: string;
  amount: string;
  status: string;
}

export default function ApprovalQueue() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Track processing rows to prevent double-clicks
  const [processingItems, setProcessingItems] = useState<Record<string, boolean>>({});

  async function load() {
    try {
      setError(null);
      const [leaveRes, claimRes] = await Promise.all([
        api.get<{ data: LeaveRequest[] }>("/leaves"),
        api.get<{ data: ExpenseClaim[] }>("/claims"),
      ]);
      
      setLeaves((leaveRes?.data || []).filter((l) => l.status === "PENDING"));
      setClaims((claimRes?.data || []).filter((c) => c.status === "PENDING"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approval queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    // STALLING LOGIC: We strictly wait for the INITIAL_SESSION event from Supabase.
    // This guarantees that token headers are attached to the apiClient before calling load().
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (session) {
        // Triggers perfectly on INITIAL_SESSION or SIGNED_IN once tokens are set up
        await load();
      } else {
        setLeaves([]);
        setClaims([]);
        setError("User is not authenticated. Please log in.");
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function reviewLeave(id: string, status: "APPROVED" | "REJECTED") {
    setProcessingItems((prev) => ({ ...prev, [id]: true }));
    setError(null);
    
    const originalLeaves = [...leaves];
    setLeaves((prev) => prev.filter((l) => l.id !== id));

    try {
      await api.patch(`/leaves/${id}/approve`, { status });
    } catch (e) {
      setLeaves(originalLeaves); // Revert UI if server fails
      setError(e instanceof Error ? e.message : "Failed to update leave request");
    } finally {
      setProcessingItems((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function reviewClaim(id: string, status: "APPROVED" | "REJECTED") {
    setProcessingItems((prev) => ({ ...prev, [id]: true }));
    setError(null);

    const originalClaims = [...claims];
    setClaims((prev) => prev.filter((c) => c.id !== id));

    try {
      await api.patch(`/claims/${id}/review`, { status });
    } catch (e) {
      setClaims(originalClaims); // Revert UI if server fails
      setError(e instanceof Error ? e.message : "Failed to update expense claim");
    } finally {
      setProcessingItems((prev) => ({ ...prev, [id]: false }));
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm animate-pulse max-w-4xl mx-auto">
        <p className="text-sm text-slate-500 font-medium">Verifying authorization and loading queue...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Approval Queue</h3>
          <p className="text-xs text-slate-500 mt-0.5">Manage employee workspace dashboard exceptions</p>
        </div>
        <button 
          onClick={load} 
          className="text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 px-2.5 py-1.5 rounded-md transition-colors"
        >
          Refresh Queue
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Pending Leave Requests */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Pending Leave Requests</h4>
        {leaves.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400 bg-slate-50 border border-dashed rounded-lg p-4 text-center">Nothing pending.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {leaves.map((l) => {
              const isProcessing = processingItems[l.id];
              return (
                <li key={l.id} className={`flex items-center justify-between rounded-lg border bg-white p-4 transition-all ${isProcessing ? "opacity-60 bg-slate-50 pointer-events-none" : "hover:border-slate-300"}`}>
                  <div>
                    <p className="font-medium text-slate-900">
                      {l.employee?.firstName || "Unknown"} {l.employee?.lastName || "Employee"} · <span className="text-slate-600 font-normal">{l.leaveType}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {l.startDate?.slice(0, 10)} &rarr; {l.endDate?.slice(0, 10)} 
                      <span className="ml-1.5 font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">({l.totalDays} days)</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewLeave(l.id, "APPROVED")}
                      disabled={isProcessing}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reviewLeave(l.id, "REJECTED")}
                      disabled={isProcessing}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 shadow-sm transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pending Expense Claims */}
      <div className="mt-8">
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Pending Expense Claims</h4>
        {claims.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400 bg-slate-50 border border-dashed rounded-lg p-4 text-center">Nothing pending.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {claims.map((c) => {
              const isProcessing = processingItems[c.id];
              return (
                <li key={c.id} className={`flex items-center justify-between rounded-lg border bg-white p-4 transition-all ${isProcessing ? "opacity-60 bg-slate-50 pointer-events-none" : "hover:border-slate-300"}`}>
                  <div>
                    <p className="font-medium text-slate-900">{c.claimType}</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5">₹{parseFloat(c.amount).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewClaim(c.id, "APPROVED")}
                      disabled={isProcessing}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reviewClaim(c.id, "REJECTED")}
                      disabled={isProcessing}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 shadow-sm transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

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
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [leaveRes, claimRes] = await Promise.all([
        api.get<{ data: LeaveRequest[] }>("/leaves"),
        api.get<{ data: ExpenseClaim[] }>("/claims"),
      ]);
      setLeaves(leaveRes.data.filter((l) => l.status === "PENDING"));
      setClaims(claimRes.data.filter((c) => c.status === "PENDING"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approval queue");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function reviewLeave(id: string, status: "APPROVED" | "REJECTED") {
    await api.patch(`/leaves/${id}/approve`, { status });
    load();
  }

  async function reviewClaim(id: string, status: "APPROVED" | "REJECTED") {
    await api.patch(`/claims/${id}/review`, { status });
    load();
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="font-semibold">Approval Queue</h3>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        <h4 className="text-sm font-medium text-slate-700">Pending Leave Requests</h4>
        {leaves.length === 0 && <p className="mt-1 text-sm text-slate-500">Nothing pending.</p>}
        <ul className="mt-2 space-y-2">
          {leaves.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">
                  {l.employee.firstName} {l.employee.lastName} · {l.leaveType}
                </p>
                <p className="text-slate-500">
                  {l.startDate.slice(0, 10)} → {l.endDate.slice(0, 10)} ({l.totalDays} days)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => reviewLeave(l.id, "APPROVED")}
                  className="rounded-md bg-emerald-500 px-3 py-1 text-white text-xs hover:bg-emerald-600"
                >
                  Approve
                </button>
                <button
                  onClick={() => reviewLeave(l.id, "REJECTED")}
                  className="rounded-md bg-red-500 px-3 py-1 text-white text-xs hover:bg-red-600"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-medium text-slate-700">Pending Expense Claims</h4>
        {claims.length === 0 && <p className="mt-1 text-sm text-slate-500">Nothing pending.</p>}
        <ul className="mt-2 space-y-2">
          {claims.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{c.claimType}</p>
                <p className="text-slate-500">₹{c.amount}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => reviewClaim(c.id, "APPROVED")}
                  className="rounded-md bg-emerald-500 px-3 py-1 text-white text-xs hover:bg-emerald-600"
                >
                  Approve
                </button>
                <button
                  onClick={() => reviewClaim(c.id, "REJECTED")}
                  className="rounded-md bg-red-500 px-3 py-1 text-white text-xs hover:bg-red-600"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

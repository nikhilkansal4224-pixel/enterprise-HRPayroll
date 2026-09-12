"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";

const LEAVE_TYPES = ["SICK", "CASUAL", "EARNED"] as const;

export default function LeaveForm() {
  const [leaveType, setLeaveType] = useState<(typeof LEAVE_TYPES)[number]>("CASUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await api.post("/leaves/request", { leaveType, startDate, endDate, reason });
      setMessage({ type: "success", text: "Leave request submitted." });
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to submit" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
      <h3 className="font-semibold">Request Leave</h3>

      <div>
        <label className="block text-sm font-medium text-slate-700">Leave type</label>
        <select
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value as (typeof LEAVE_TYPES)[number])}
          className="mt-1 w-full rounded-lg border-slate-300 text-sm"
        >
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Start date</label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">End date</label>
          <input
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-lg border-slate-300 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border-slate-300 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Request"}
      </button>

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

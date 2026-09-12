"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";

interface AttendanceLog {
  id: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

export default function ClockInOut() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<AttendanceLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "check-in" | "check-out") {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ data: AttendanceLog }>(`/attendance/${action}`);
      setLog(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="font-semibold">Attendance</h3>
      <p className="mt-1 text-sm text-slate-600">Clock in when you start work, clock out when you finish.</p>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => handle("check-in")}
          disabled={loading}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Check In
        </button>
        <button
          onClick={() => handle("check-out")}
          disabled={loading}
          className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
        >
          Check Out
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {log && (
        <div className="mt-4 text-sm text-slate-600">
          <p>Status: <span className="font-medium">{log.status}</span></p>
          {log.checkIn && <p>Checked in at: {new Date(log.checkIn).toLocaleTimeString()}</p>}
          {log.checkOut && <p>Checked out at: {new Date(log.checkOut).toLocaleTimeString()}</p>}
        </div>
      )}
    </div>
  );
}

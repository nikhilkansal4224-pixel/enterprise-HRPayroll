"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { supabase } from "@/lib/supabaseClient";

interface AttendanceLog {
  id: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

export default function ClockInOut() {
  // Keeps the buttons disabled until Supabase auth signals it is ready
  const [loading, setLoading] = useState<boolean>(true);
  const [log, setLog] = useState<AttendanceLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Separate function to pull today's log status safely
  async function loadTodayStatus() {
    try {
      const res = await api.get<{ data: AttendanceLog }>("/attendance/today");
      setLog(res.data);
    } catch (e) {
      // Quietly log if there's no entry for today yet; don't flash an error screen
      console.log("No existing attendance record for today yet.");
    } finally {
      setLoading(false); // Auth is verified and data loaded, unlock the UI buttons
    }
  }

  useEffect(() => {
    let isMounted = true;

    // STALLING SEED: We pause execution and listen explicitly for Supabase's handshake
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (session) {
        // Token state established in memory -> safe to fetch from backend
        await loadTodayStatus();
      } else {
        setLog(null);
        setError("User is not authenticated. Please log in.");
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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

  // UI state states derived directly from backend values
  const isCheckedIn = log?.status === "checked-in";
  const isCheckedOut = log?.status === "checked-out";

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-slate-900">Attendance</h3>
      <p className="mt-1 text-sm text-slate-600">Clock in when you start work, clock out when you finish.</p>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => handle("check-in")}
          // Disable while stalling/loading OR if already clocked in/out
          disabled={loading || isCheckedIn || isCheckedOut}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {loading && !log ? "Verifying Auth..." : "Check In"}
        </button>
        <button
          onClick={() => handle("check-out")}
          // Disable while stalling/loading OR if they haven't clocked in yet OR if already finished
          disabled={loading || !isCheckedIn || isCheckedOut}
          className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"
        >
          Check Out
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {log && (
        <div className="mt-4 text-sm text-slate-600 border-t pt-3">
          <p>Status: <span className="font-semibold capitalize text-slate-900">{log.status.replace("-", " ")}</span></p>
          {log.checkIn && <p className="mt-1">Checked in at: {new Date(log.checkIn).toLocaleTimeString()}</p>}
          {log.checkOut && <p className="mt-1">Checked out at: {new Date(log.checkOut).toLocaleTimeString()}</p>}
        </div>
      )}
    </div>
  );
}

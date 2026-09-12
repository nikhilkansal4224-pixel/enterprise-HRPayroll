"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";

interface PayrollResult {
  employeeId: string;
  employeeCode: string;
  name: string;
  payableDays: number;
  totalDaysInMonth: number;
  grossEarnings: number;
  pfDeduction: number;
  tdsDeduction: number;
  netPayable: number;
}

const now = new Date();

export default function PayrollBoard() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<PayrollResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPayroll() {
    setRunning(true);
    setError(null);
    try {
      const res = await api.post<{ data: PayrollResult[] }>("/payroll/calculate", { month, year });
      setResults(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payroll run failed");
    } finally {
      setRunning(false);
    }
  }

  async function exportTally() {
    try {
      const res = await api.get<{ data: unknown }>(`/payroll/export-tally?month=${month}&year=${year}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tally-export-${year}-${month}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="font-semibold">Monthly Payroll</h3>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">Month</label>
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="mt-1 w-20 rounded-lg border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 w-24 rounded-lg border-slate-300 text-sm"
          />
        </div>
        <button
          onClick={runPayroll}
          disabled={running}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {running ? "Calculating..." : "Run Payroll"}
        </button>
        <button
          onClick={exportTally}
          className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
        >
          Export for Tally (CA review)
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {results && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">Employee</th>
                <th className="py-2 pr-4">Payable Days</th>
                <th className="py-2 pr-4">Gross</th>
                <th className="py-2 pr-4">PF</th>
                <th className="py-2 pr-4">TDS</th>
                <th className="py-2 pr-4">Net Payable</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.employeeId} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    {r.name} <span className="text-slate-400">({r.employeeCode})</span>
                  </td>
                  <td className="py-2 pr-4">
                    {r.payableDays}/{r.totalDaysInMonth}
                  </td>
                  <td className="py-2 pr-4">₹{r.grossEarnings.toFixed(2)}</td>
                  <td className="py-2 pr-4">₹{r.pfDeduction.toFixed(2)}</td>
                  <td className="py-2 pr-4">₹{r.tdsDeduction.toFixed(2)}</td>
                  <td className="py-2 pr-4 font-semibold text-brand-700">
                    ₹{r.netPayable.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

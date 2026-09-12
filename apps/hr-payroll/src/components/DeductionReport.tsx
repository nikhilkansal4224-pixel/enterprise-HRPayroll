"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";

interface TallyExport {
  period: { month: number; year: number };
  ledgerSummary: {
    salariesPayable: number;
    pfLiability: number;
    tdsLiability: number;
    grossSalaryExpense: number;
  };
  employeeBreakdown: Array<{
    employeeCode: string;
    name: string;
    department: string | null;
    grossEarnings: number;
    pfDeduction: number;
    tdsDeduction: number;
    netPayable: number;
  }>;
}

const now = new Date();

export default function DeductionReport() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<TallyExport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    setError(null);
    try {
      const res = await api.get<{ data: TallyExport }>(`/payroll/export-tally?month=${month}&year=${year}`);
      setReport(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report. Run payroll for this period first.");
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="font-semibold">Statutory Deduction Report</h3>

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
          onClick={loadReport}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Load Report
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {report && (
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Gross Salary Expense" value={report.ledgerSummary.grossSalaryExpense} />
            <Stat label="PF Liability" value={report.ledgerSummary.pfLiability} />
            <Stat label="TDS Liability" value={report.ledgerSummary.tdsLiability} />
            <Stat label="Salaries Payable" value={report.ledgerSummary.salariesPayable} />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">PF</th>
                  <th className="py-2 pr-4">TDS</th>
                  <th className="py-2 pr-4">Net Payable</th>
                </tr>
              </thead>
              <tbody>
                {report.employeeBreakdown.map((e) => (
                  <tr key={e.employeeCode} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {e.name} <span className="text-slate-400">({e.employeeCode})</span>
                    </td>
                    <td className="py-2 pr-4">{e.department ?? "—"}</td>
                    <td className="py-2 pr-4">₹{e.pfDeduction.toFixed(2)}</td>
                    <td className="py-2 pr-4">₹{e.tdsDeduction.toFixed(2)}</td>
                    <td className="py-2 pr-4 font-semibold text-brand-700">₹{e.netPayable.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">₹{value.toFixed(2)}</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

interface Payslip {
  id: string;
  month: number;
  year: number;
  grossEarnings: string;
  pfDeduction: string;
  tdsDeduction: string;
  netPayable: string;
  generatedAt: string;
}

export default function PayslipPreview() {
  const [payslips, setPayslips] = useState<Payslip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // NOTE: This calls a convenience "my payslips" style endpoint.
    // If you haven't added one yet, wire this up to a GET /api/v1/payroll/me
    // route on the backend that mirrors the tenant-scoped pattern used
    // elsewhere (see src/routes/payroll.ts for the pattern to extend).
    api
      .get<{ data: Payslip[] }>("/payroll/me")
      .then((res) => setPayslips(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load payslips"));
  }, []);

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="font-semibold">My Payslips</h3>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!error && !payslips && <p className="mt-3 text-sm text-slate-500">Loading...</p>}

      {payslips && payslips.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No payslips generated yet.</p>
      )}

      {payslips && payslips.length > 0 && (
        <div className="mt-4 divide-y">
          {payslips.map((p) => (
            <div key={p.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">
                  {p.month}/{p.year}
                </p>
                <p className="text-slate-500">
                  Gross ₹{p.grossEarnings} · PF ₹{p.pfDeduction} · TDS ₹{p.tdsDeduction}
                </p>
              </div>
              <p className="font-semibold text-brand-700">₹{p.netPayable}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

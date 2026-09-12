/**
 * Payroll calculation engine.
 *
 * BUSINESS RULES (documented assumptions — review with your CA/finance team
 * before relying on this for statutory filings):
 *
 *  - Total Days   = calendar days in the given month.
 *  - Unpaid Days  = days marked ABSENT in attendance_logs for that month,
 *                   plus 0.5 for each HALF_DAY, plus any APPROVED leave_requests
 *                   days that exceed the employee's paid-leave entitlement.
 *                   For this scaffold, all APPROVED leave_requests are treated
 *                   as PAID leave (SICK/CASUAL/EARNED are the only leave types
 *                   in scope), and only ABSENT / HALF_DAY attendance affects pay.
 *  - Payable Days = Total Days - Unpaid Days.
 *  - Gross Pay    = (base_salary / Total Days) * Payable Days.
 *  - PF           = PF_EMPLOYEE_RATE * min(base_salary, PF_WAGE_CEILING), prorated
 *                   by Payable Days / Total Days (statutory PF wage ceiling is
 *                   configurable via env, defaults to the Indian EPF ceiling of
 *                   ₹15,000/month).
 *  - TDS          = simplified monthly withholding estimated from an annualized
 *                   slab calculation on (Gross Pay * 12 - PF * 12). This is a
 *                   PLACEHOLDER for illustration — real TDS requires the
 *                   employee's full tax regime election, other-income
 *                   declarations, Section 80C/80D proofs, etc.
 *  - Net Payable  = Gross Pay - PF - TDS.
 */

export interface PayrollInputs {
  baseSalary: number;
  month: number; // 1-12
  year: number;
  absentDays: number;
  halfDays: number;
  pfEmployeeRate?: number; // default 0.12
  pfWageCeiling?: number; // default 15000
}

export interface PayrollResult {
  totalDaysInMonth: number;
  unpaidDays: number;
  payableDays: number;
  grossEarnings: number;
  pfDeduction: number;
  tdsDeduction: number;
  totalDeductions: number;
  netPayable: number;
}

export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Simplified annualized-slab TDS estimate (illustrative — not a substitute for
 * a proper payroll tax engine). Slabs shown are representative of the Indian
 * "new regime" style structure and should be replaced with the values your
 * finance/compliance team certifies for the relevant financial year.
 */
export function estimateAnnualTds(annualTaxableIncome: number): number {
  const slabs: Array<[number, number, number]> = [
    // [lowerBound, upperBound, rate]
    [0, 300000, 0],
    [300000, 600000, 0.05],
    [600000, 900000, 0.1],
    [900000, 1200000, 0.15],
    [1200000, 1500000, 0.2],
    [1500000, Infinity, 0.3],
  ];

  let tax = 0;
  for (const [lower, upper, rate] of slabs) {
    if (annualTaxableIncome > lower) {
      const taxableInThisSlab = Math.min(annualTaxableIncome, upper) - lower;
      tax += taxableInThisSlab * rate;
    }
  }

  // Simplified 4% health & education cess.
  tax *= 1.04;
  return Math.max(0, tax);
}

export function calculatePayroll(inputs: PayrollInputs): PayrollResult {
  const {
    baseSalary,
    month,
    year,
    absentDays,
    halfDays,
    pfEmployeeRate = Number(process.env.PF_EMPLOYEE_RATE ?? 0.12),
    pfWageCeiling = Number(process.env.PF_WAGE_CEILING ?? 15000),
  } = inputs;

  const totalDaysInMonth = daysInMonth(month, year);
  const unpaidDays = Math.min(totalDaysInMonth, absentDays + halfDays * 0.5);
  const payableDays = Math.max(0, totalDaysInMonth - unpaidDays);

  const perDaySalary = baseSalary / totalDaysInMonth;
  const grossEarnings = round2(perDaySalary * payableDays);

  const pfWageBase = Math.min(baseSalary, pfWageCeiling);
  const pfDeduction = round2(pfWageBase * pfEmployeeRate * (payableDays / totalDaysInMonth));

  const annualTaxableIncome = Math.max(0, grossEarnings * 12 - pfDeduction * 12);
  const tdsDeduction = round2(estimateAnnualTds(annualTaxableIncome) / 12);

  const totalDeductions = round2(pfDeduction + tdsDeduction);
  const netPayable = round2(grossEarnings - totalDeductions);

  return {
    totalDaysInMonth,
    unpaidDays,
    payableDays,
    grossEarnings,
    pfDeduction,
    tdsDeduction,
    totalDeductions,
    netPayable,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

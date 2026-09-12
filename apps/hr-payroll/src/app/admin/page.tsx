import PayrollBoard from "@/components/PayrollBoard";
import ApprovalQueue from "@/components/ApprovalQueue";
import DeductionReport from "@/components/DeductionReport";

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">HR Admin</h1>
      <p className="mt-1 text-sm text-slate-600">
        Run payroll, review pending approvals, and check statutory deductions before CA sign-off.
      </p>

      <div className="mt-6 space-y-6">
        <PayrollBoard />
        <ApprovalQueue />
        <DeductionReport />
      </div>
    </div>
  );
}

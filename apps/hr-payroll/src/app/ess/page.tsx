import ClockInOut from "@/components/ClockInOut";
import LeaveForm from "@/components/LeaveForm";
import ClaimUpload from "@/components/ClaimUpload";
import PayslipPreview from "@/components/PayslipPreview";

export default function EssPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Employee Self-Service</h1>
      <p className="mt-1 text-sm text-slate-600">
        Manage your attendance, leave, claims, and payslips.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ClockInOut />
        <PayslipPreview />
        <LeaveForm />
        <ClaimUpload />
      </div>
    </div>
  );
}

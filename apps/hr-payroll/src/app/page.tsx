export default function HomePage() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <a
        href="/ess"
        className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
      >
        <h2 className="text-lg font-semibold text-brand-700">Employee Self-Service</h2>
        <p className="mt-2 text-sm text-slate-600">
          Clock in/out, request leave, submit claims, and view your payslips.
        </p>
      </a>
      <a
        href="/admin"
        className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
      >
        <h2 className="text-lg font-semibold text-brand-700">HR Admin</h2>
        <p className="mt-2 text-sm text-slate-600">
          Run monthly payroll, approve leave and claims, and review statutory deductions.
        </p>
      </a>
    </div>
  );
}

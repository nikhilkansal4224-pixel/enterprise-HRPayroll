import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "HR & Payroll",
  description: "Employee self-service and HR admin dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <a href="/" className="font-semibold text-brand-700">
                HR &amp; Payroll
              </a>
              <nav className="flex gap-4 text-sm">
                <a href="/ess" className="hover:text-brand-600">
                  Employee Self-Service
                </a>
                <a href="/admin" className="hover:text-brand-600">
                  HR Admin
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-8">{children}</main>
          <footer className="border-t bg-white text-xs text-slate-500">
            <div className="mx-auto max-w-6xl px-4 py-4">
              repo-hr-payroll — demo dashboard, not for production statutory filings without CA review.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

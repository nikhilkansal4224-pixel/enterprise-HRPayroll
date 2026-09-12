"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import { supabase } from "@/lib/supabaseClient";

interface SignedUploadUrlResponse {
  data: { path: string; signedUrl: string; token: string };
}

export default function ClaimUpload() {
  const [claimType, setClaimType] = useState("Travel");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      let proofDocumentUrl: string | undefined;

      if (file) {
        // 1. Ask the backend for a signed upload URL (path is tenant/employee scoped).
        const { data: signed } = await api.post<SignedUploadUrlResponse>("/claims/upload-url", {
          fileName: file.name,
        });

        // 2. Upload the file bytes directly to Supabase Storage.
        const { error: uploadError } = await supabase.storage
          .from("expense-proofs")
          .uploadToSignedUrl(signed.path, signed.token, file);
        if (uploadError) throw uploadError;

        const { data: pub } = supabase.storage.from("expense-proofs").getPublicUrl(signed.path);
        proofDocumentUrl = pub.publicUrl;
      }

      await api.post("/claims/submit", {
        claimType,
        amount: Number(amount),
        proofDocumentUrl,
      });

      setMessage({ type: "success", text: "Claim submitted for review." });
      setAmount("");
      setFile(null);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to submit claim" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
      <h3 className="font-semibold">Submit Expense Claim</h3>

      <div>
        <label className="block text-sm font-medium text-slate-700">Claim type</label>
        <input
          value={claimType}
          onChange={(e) => setClaimType(e.target.value)}
          className="mt-1 w-full rounded-lg border-slate-300 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-lg border-slate-300 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Proof document (optional)</label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Claim"}
      </button>

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

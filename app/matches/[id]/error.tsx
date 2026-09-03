"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function MatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Match page error:", error);
  }, [error]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-red-50 mx-auto mb-6 flex items-center justify-center">
        <AlertTriangle className="w-10 h-10 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        We couldn't load this match's predictions. This might be a temporary issue.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-pitch-600 text-white rounded-lg font-medium hover:bg-pitch-700 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to matches
        </Link>
      </div>
    </main>
  );
}

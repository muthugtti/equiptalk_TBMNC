import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center">
      <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        Equiptalk AI
      </h1>
      <p className="text-xl mb-12 max-w-2xl text-gray-600 dark:text-gray-300">
        Intelligent equipment management and documentation assistance powered by Gemini AI.
      </p>

      <Link
        href="/login"
        className="group px-8 py-4 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-lg bg-white dark:bg-neutral-900/50"
      >
        <span className="text-2xl font-semibold group-hover:text-indigo-600 transition-colors">
          Go to Dashboard →
        </span>
      </Link>
    </main>
  );
}

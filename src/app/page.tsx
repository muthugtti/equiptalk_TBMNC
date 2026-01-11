
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center">
      <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        Equiptalk AI
      </h1>
      <p className="text-xl mb-12 max-w-2xl text-gray-600 dark:text-gray-300">
        Intelligent equipment management and documentation assistance powered by Vertex AI.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        <Link
          href="/qr"
          className="group p-8 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-lg bg-white dark:bg-neutral-900/50"
        >
          <h2 className="text-2xl font-semibold mb-3 group-hover:text-blue-600 transition-colors">
            Scan QR Code &to;
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Access equipment details by scanning a physical QR code.
          </p>
        </Link>

        <Link
          href="/chat"
          className="group p-8 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-lg bg-white dark:bg-neutral-900/50"
        >
          <h2 className="text-2xl font-semibold mb-3 group-hover:text-indigo-600 transition-colors">
            Start Chat &to;
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Chat with the AI assistant to find information in manuals.
          </p>
        </Link>
      </div>
    </main>
  );
}

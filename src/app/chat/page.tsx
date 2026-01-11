
export default function ChatPage() {
    return (
        <div className="flex min-h-screen flex-col p-6">
            <header className="mb-6">
                <h1 className="text-2xl font-bold">Equiptalk Chat</h1>
            </header>

            <div className="flex-1 bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-neutral-800">
                <div className="text-center text-gray-500 mt-20">
                    <p>Start asking questions about your equipment.</p>
                </div>
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Type your message..."
                    className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                />
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    Send
                </button>
            </div>
        </div>
    );
}

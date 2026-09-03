export default function MatchLoading() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="rounded-2xl border border-gray-200 bg-white p-6 mb-6">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex flex-col items-center px-8">
            <div className="h-8 w-12 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 h-96">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 h-44">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-20 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 h-44">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-20 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}

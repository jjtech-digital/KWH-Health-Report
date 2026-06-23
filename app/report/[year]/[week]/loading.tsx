export default function ReportLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8 animate-pulse">
        <div className="h-20 rounded-xl bg-muted" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-96 rounded-xl bg-muted" />
          <div className="lg:col-span-2 h-96 rounded-xl bg-muted" />
        </div>
        <div className="h-64 rounded-xl bg-muted" />
        <div className="h-48 rounded-xl bg-muted" />
        <div className="h-72 rounded-xl bg-muted" />
      </div>
    </main>
  )
}

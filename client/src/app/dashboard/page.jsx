import Navbar from "@/components/Navbar";

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pt-32 pb-16">

        <section className="mx-auto max-w-3xl">
          <div className="glass-card rounded-2xl p-6 md:p-8 border border-border">
            <div className="rounded-2xl border border-dashed border-primary/40 bg-secondary/40 px-6 py-12 text-center">
              <p className="text-sm font-mono uppercase tracking-[0.2em] text-primary">
                CSV Upload
              </p>
              <h2 className="mt-4 text-2xl font-serif text-foreground">
                Upload CSV transaction data file
              </h2>
              <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
                Supported fields can include transaction amount, timestamp,
                location, device information, IP address, and payment method.
              </p>

              <div className="mt-8 flex flex-col items-center gap-4">
                <label
                  htmlFor="transaction-file"
                  className="inline-flex cursor-pointer items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  Choose CSV File
                </label>
                <input
                  id="transaction-file"
                  type="file"
                  accept=".csv"
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Only client-side UI added here. No backend upload logic changed.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default DashboardPage;

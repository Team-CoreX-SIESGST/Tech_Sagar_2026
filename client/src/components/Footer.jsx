const FooterCTA = () => {
  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl md:text-[44px] leading-[1.15] font-serif text-foreground">
          Built for noisy data,
          <br />
          <span className="font-bold">clear fraud decisions, and fast review.</span>
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          PARKHI.ai | Predictive Anomaly Recognition & Knowledge-based Hazard Intelligence | Tech Sagar 2026
        </p>
        <div className="mt-8">
          <a href="#demo" className="btn-primary animate-glow-pulse">
            Explore the Demo →
          </a>
        </div>
      </div>

      <div className="mt-24 border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="font-serif text-foreground text-sm">PARKHI.ai</span>
          </div>
          <p>© 2026 | Predictive anomaly recognition workspace</p>
          <a href="#" className="text-primary hover:underline">GitHub →</a>
        </div>
      </div>
    </section>
  );
};

export default FooterCTA;

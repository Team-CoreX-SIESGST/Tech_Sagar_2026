import useScrollReveal from "@/hooks/useScrollReveal";
import CircularFlowDiagram from "./CircularFlowDiagram";

const steps = [
  {
    num: "01",
    title: "Upload",
    subtitle: "Accept raw transaction CSV files",
    body: "Bring in datasets containing amount, timestamp, location, device, IP address, payment method, and user activity fields without changing your backend flow.",
  },
  {
    num: "02",
    title: "Clean",
    subtitle: "Standardize messy real-world records",
    body: "Merge duplicate columns like amt into transaction_amount, normalize timestamps, standardize city names, remove duplicate records, handle missing values, and flag invalid IP addresses.",
  },
  {
    num: "03",
    title: "Explore",
    subtitle: "Run EDA on quality and behavior",
    body: "Highlight nulls, duplicates, invalid entries, and key distributions across transaction amounts, payment methods, device usage, and time-of-day activity.",
  },
  {
    num: "04",
    title: "Model",
    subtitle: "Engineer features for fraud detection",
    body: "Create user-level behavioral signals such as spending deviation, transaction velocity, unusual devices, location drift, and odd transaction times before scoring.",
  },
  {
    num: "05",
    title: "Explain",
    subtitle: "Predict risk and show why",
    body: "Return a fraud prediction, risk score, and explanation layer so users can inspect the model decision instead of treating it as a black box.",
  },
];

const HowItWorksSection = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-secondary">
      <div
        ref={ref}
        className="mx-auto max-w-6xl px-6"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.6s ease",
        }}
      >
        <div className="grid md:grid-cols-2 gap-12 items-center mb-14">
          <div>
            <span className="text-8xl font-mono text-primary text-bold mb-2">
              HOW IT WORKS
            </span>
            <h2 className="mt-6 text-3xl md:text-[42px] leading-[1.15] font-serif text-foreground">
              From raw transactions to
              <br />
              <span className="font-bold">interpretable fraud insights.</span>
            </h2>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="float-card animate-idle-float p-5 w-full max-w-[280px]">
              <CircularFlowDiagram />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className="glass-card !p-5 flex flex-col"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <span className="text-2xl font-mono text-primary mb-2" style={{ opacity: 0.3 }}>
                {s.num}
              </span>
              <h3 className="text-base font-serif text-foreground">{s.title}</h3>
              <p className="text-xs font-mono text-primary mb-2">{s.subtitle}</p>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;

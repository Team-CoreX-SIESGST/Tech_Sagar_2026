import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Brain,
  Radar,
  MessageCircle,
  TrendingUp,
  Map,
  GitBranch,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Data Cleaning Engine",
    description:
      "Standardize raw CSV uploads by fixing amount formats, normalizing timestamps, merging duplicate columns, and correcting invalid records.",
  },
  {
    icon: Radar,
    title: "EDA Quality Checks",
    description:
      "Surface missing values, duplicate rows, transaction_id conflicts, invalid IPs, and distribution shifts before modeling begins.",
  },
  {
    icon: TrendingUp,
    title: "Behavior Features",
    description:
      "Derive average spend, deviation from normal behavior, transaction velocity, unusual transaction time, and location drift for each user.",
  },
  {
    icon: Map,
    title: "Device And Location Signals",
    description:
      "Track new devices, device reuse, city standardization, and geo mismatches that often reveal account takeover or synthetic activity.",
  },
  {
    icon: GitBranch,
    title: "Fraud Risk Scoring",
    description:
      "Use engineered features to power a fraud model that returns a prediction and a transaction-level risk score for every record.",
  },
  {
    icon: MessageCircle,
    title: "Explainable Alerts",
    description:
      "Show why a transaction was flagged with feature contribution hints so analysts can trust the decision and act faster.",
  },
];

const FeatureCard = ({ feature, index }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="glass-card glow-border-hover p-8 rounded-2xl group cursor-default"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-5 group-hover:bg-primary/25 transition-colors duration-500">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-foreground mb-3">
        {feature.title}
      </h3>
      <p className="font-body text-sm text-muted-foreground leading-relaxed">
        {feature.description}
      </p>
    </motion.div>
  );
};

const FeaturesSection = () => {
  return (
    <section id="features" className="section-spacing relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
            Fraud Detection, <span className="text-gradient-primary">End To End</span>
          </h2>
          <p className="font-body text-muted-foreground text-lg max-w-2xl mx-auto">
            From messy transaction files to interpretable fraud predictions,
            every stage is designed for practical analyst workflows.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { lazy, Suspense, useRef, type ReactNode } from "react";
const TracingBeamDemo = lazy(() => import("@/components/TracingBeamDemo"));
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Shield,
  MapPin,
  AlertTriangle,
  Route,
  Users,
  BarChart3,
  ArrowRight,
  ChevronRight,
  Zap,
  Clock,
  TrendingDown,
  Globe,
  Star,
} from "lucide-react";

// Animated section wrapper using IntersectionObserver
function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Floating decorative orb
function FloatingOrb({
  className,
  delay = 0,
}: {
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{
        y: [0, -20, 0],
        x: [0, 10, 0],
        scale: [1, 1.05, 1],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0.3]);

  const features = [
    {
      icon: AlertTriangle,
      title: "Report Incidents",
      description:
        "Instantly report potholes, accidents, landslides, and road hazards. Help keep every driver informed.",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      icon: Shield,
      title: "Risk-Based Routes",
      description:
        "Get sorted route options scored by real-time road risk — choose the safest path every time.",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: MapPin,
      title: "Live Road Map",
      description:
        "Interactive map with real-time incident markers and heatmaps showing road conditions.",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      icon: Route,
      title: "Smart Navigation",
      description:
        "Travel time estimates factoring in incidents, traffic density, and road quality data.",
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      icon: Users,
      title: "Community Driven",
      description:
        "Every report strengthens the network. Verify incidents, earn trust, and shape safer roads together.",
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
    {
      icon: BarChart3,
      title: "Road Analytics",
      description:
        "Track your driving sessions, view incident history, and see how your reports improve road safety.",
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
  ];

  const stats = [
    { value: "50K+", label: "Incidents Reported", icon: AlertTriangle },
    { value: "2.1M", label: "Routes Calculated", icon: Route },
    { value: "120K", label: "Active Drivers", icon: Users },
    { value: "34%", label: "Accidents Reduced", icon: TrendingDown },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Daily Commuter",
      text: "RoTraff saved me from a flooded highway last week. The community reports are incredibly accurate.",
      stars: 5,
    },
    {
      name: "Marcus Rivera",
      role: "Fleet Manager",
      text: "We've reduced vehicle damage by 40% since integrating RoTraff risk scores into our route planning.",
      stars: 5,
    },
    {
      name: "Aisha Patel",
      role: "City Planner",
      text: "The incident data from RoTraff has become invaluable for identifying infrastructure priorities.",
      stars: 5,
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden gradient-bg">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="glass-strong rounded-2xl px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="RoTraff" className="w-9 h-9 rounded-xl shadow-lg shadow-blue-500/20 object-cover" />
              <span className="text-lg font-bold tracking-tight text-foreground">
                RoTraff
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                How It Works
              </a>
              <a
                href="#community"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Community
              </a>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/auth")}
                className="hidden sm:flex cursor-pointer"
              >
                Sign in
              </Button>
              <Button
                size="sm"
                onClick={() => navigate("/auth")}
                className="cursor-pointer bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600 shadow-lg shadow-blue-500/20"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
        {/* Background orbs */}
        <FloatingOrb
          className="w-96 h-96 bg-blue-400/20 top-20 -left-48"
          delay={0}
        />
        <FloatingOrb
          className="w-80 h-80 bg-violet-400/15 top-40 right-0"
          delay={2}
        />
        <FloatingOrb
          className="w-64 h-64 bg-cyan-400/10 bottom-20 left-1/3"
          delay={4}
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                Real-time road intelligence — v1 launched
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]"
            >
              Every road.{" "}
              <span className="gradient-text">Every hazard.</span>
              <br />
              Every driver protected.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              Report road incidents in seconds. Get risk-scored route options
              ranked by safety. Drive smarter with a community that watches out
              for each other.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="cursor-pointer bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600 shadow-xl shadow-blue-500/25 px-8 py-6 text-base font-semibold rounded-2xl"
              >
                Start Reporting
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="cursor-pointer glass border-white/40 hover:bg-white/40 px-8 py-6 text-base font-semibold rounded-2xl"
              >
                Explore the Map
                <MapPin className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>

            {/* Hero visual — glass map preview */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.9 }}
              className="mt-16 relative mx-auto max-w-4xl"
            >
              <div className="glass-card p-1 rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/10">
                <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 via-cyan-50 to-violet-50 h-64 sm:h-80 lg:h-96">
                  {/* Simulated map content */}
                  <div className="absolute inset-0 opacity-40">
                    <div className="absolute top-1/4 left-1/4 w-32 h-1 bg-blue-300 rounded-full rotate-45" />
                    <div className="absolute top-1/3 left-1/2 w-48 h-1 bg-blue-200 rounded-full -rotate-12" />
                    <div className="absolute top-1/2 left-1/3 w-40 h-1 bg-blue-300 rounded-full rotate-12" />
                    <div className="absolute top-2/3 left-1/4 w-56 h-1 bg-blue-200 rounded-full -rotate-6" />
                    <div className="absolute top-1/2 left-1/2 w-36 h-1 bg-blue-300 rounded-full rotate-30" />
                  </div>

                  {/* Incident markers */}
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[30%] left-[25%] w-10 h-10 rounded-full bg-amber-400/90 flex items-center justify-center shadow-lg shadow-amber-400/30"
                  >
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </motion.div>
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    className="absolute top-[55%] left-[60%] w-10 h-10 rounded-full bg-red-400/90 flex items-center justify-center shadow-lg shadow-red-400/30"
                  >
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </motion.div>
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute top-[40%] left-[45%] w-10 h-10 rounded-full bg-emerald-400/90 flex items-center justify-center shadow-lg shadow-emerald-400/30"
                  >
                    <MapPin className="w-5 h-5 text-white" />
                  </motion.div>

                  {/* Route line */}
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 800 400"
                  >
                    <motion.path
                      d="M 120 300 Q 250 150 380 200 T 650 100"
                      fill="none"
                      stroke="url(#routeGrad)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 4"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, delay: 1.2, ease: "easeInOut" }}
                    />
                    <defs>
                      <linearGradient
                        id="routeGrad"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="oklch(0.52 0.14 255)" />
                        <stop offset="100%" stopColor="oklch(0.6 0.12 180)" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Origin / destination pins */}
                  <div className="absolute bottom-[22%] left-[14%] glass-strong rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-medium text-foreground">Origin</span>
                  </div>
                  <div className="absolute top-[18%] right-[16%] glass-strong rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                    <span className="text-xs font-medium text-foreground">Destination</span>
                  </div>
                </div>
              </div>

              {/* Floating glass info cards */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 1.5 }}
                className="absolute -left-4 top-1/2 -translate-y-1/2 glass-strong rounded-xl px-4 py-3 hidden lg:block shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Risk Score</p>
                    <p className="text-sm font-bold text-foreground">Low — 12%</p>
                  </div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 1.7 }}
                className="absolute -right-4 bottom-1/4 glass-strong rounded-xl px-4 py-3 hidden lg:block shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Time</p>
                    <p className="text-sm font-bold text-foreground">24 min</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative py-6">
        <div className="mx-auto max-w-5xl px-4">
          <AnimatedSection>
            <div className="glass-strong rounded-2xl px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <stat.icon className="w-5 h-5 text-primary mx-auto mb-2 opacity-60" />
                  <p className="text-2xl sm:text-3xl font-extrabold gradient-text">
                    {stat.value}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
              Built for everyday drivers
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Everything you need for{" "}
              <span className="gradient-text">safer roads</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
              From reporting hazards to planning the safest route — RoTraff
              gives you the tools to drive with confidence.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4, scale: 1.01 }}
                  transition={{ duration: 0.25 }}
                  className="glass-card p-6 h-full group cursor-default"
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* TracingBeam Story Section */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
              The full picture
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Why drivers choose <span className="gradient-text">RoTraff</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
              From the first tap on the map to the safest route home — here is
              how every piece fits together.
            </p>
          </AnimatedSection>

          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <div className="glass-card p-6 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground font-medium">Loading…</span>
                </div>
              </div>
            }
          >
            <TracingBeamDemo />
          </Suspense>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
              Simple &amp; effective
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              How <span className="gradient-text">RoTraff</span> works
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Report a hazard",
                description:
                  "Tap a location on the map, select the incident type and severity, and submit in seconds.",
                icon: AlertTriangle,
              },
              {
                step: "02",
                title: "Community verifies",
                description:
                  "Other drivers confirm or dispute reports, building a reliable picture of road conditions.",
                icon: Users,
              },
              {
                step: "03",
                title: "Drive the safest route",
                description:
                  "Get route options ranked by risk score and travel time. Choose the path that works best for you.",
                icon: Route,
              },
            ].map((item, i) => (
              <AnimatedSection key={item.step} delay={i * 0.15}>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl glass-strong flex items-center justify-center mx-auto mb-5 relative">
                    <item.icon className="w-7 h-7 text-primary" />
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    {item.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="community" className="relative py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
              Trusted by drivers everywhere
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              What our community{" "}
              <span className="gradient-text">says</span>
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <AnimatedSection key={t.name} delay={i * 0.12}>
                <motion.div
                  whileHover={{ y: -3 }}
                  className="glass-card p-6 h-full flex flex-col"
                >
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.stars }).map((_, si) => (
                      <Star
                        key={si}
                        className="w-4 h-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="mt-5 pt-4 border-t border-border/50">
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="glass-card p-10 sm:p-14 text-center relative overflow-hidden">
              <FloatingOrb
                className="w-48 h-48 bg-blue-400/15 -top-24 -right-24"
                delay={1}
              />
              <FloatingOrb
                className="w-32 h-32 bg-violet-400/10 -bottom-16 -left-16"
                delay={3}
              />

              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/25">
                  <Globe className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                  Ready to drive safer?
                </h2>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8 leading-relaxed">
                  Join thousands of drivers making roads safer. Report
                  incidents, plan risk-free routes, and be part of the
                  community.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    size="lg"
                    onClick={() => navigate("/auth")}
                    className="cursor-pointer bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600 shadow-xl shadow-blue-500/25 px-8 py-6 text-base font-semibold rounded-2xl"
                  >
                    Get Started Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={() => navigate("/auth")}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    Learn more
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 border-t border-border/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="RoTraff" className="w-8 h-8 rounded-lg object-cover" />
              <span className="font-bold text-foreground">RoTraff</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 RoTraff. Making every road safer, one report at a time.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </a>
              <a
                href="#community"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Community
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

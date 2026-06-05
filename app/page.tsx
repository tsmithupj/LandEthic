import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const steps = [
  {
    number: "1",
    title: "Enter your property address",
    description:
      "We pull up a satellite view of your land and map out your property lines automatically. No screenshots needed.",
  },
  {
    number: "2",
    title: "We learn about your land",
    description:
      "We look at your soil, wooded areas, water, and what animals and plants live near you to build a clear picture of where your land stands today.",
  },
  {
    number: "3",
    title: "Get a simple action plan",
    description:
      "You get a list of tasks ranked by how much good they will do. Each one tells you exactly what to do, where to do it, and why it helps.",
  },
];

const tiers = [
  {
    name: "Free",
    price: "$0",
    description: "A real look at what your land can do.",
    features: ["Satellite map of your property","Soil and land breakdown","30-day action plan","1 property"],
    cta: "Get started free",
    href: "/onboarding",
    highlighted: false,
  },
  {
    name: "Steward",
    price: "$9.99",
    period: "/mo",
    description: "A full year of direction for your land.",
    features: ["Upload photos from your land","ID plants and animals by photo","Full year action plan","Land health score"],
    cta: "Start free trial",
    href: "/onboarding",
    highlighted: true,
    badge: "Most popular",
  },
  {
    name: "Naturalist",
    price: "$19.99",
    period: "/mo",
    description: "Fresh guidance every single month.",
    features: ["Everything in Steward","Monthly task calendar","See the impact of every task","Up to 3 properties"],
    cta: "Start free trial",
    href: "/onboarding",
    highlighted: false,
  },
  {
    name: "Conservationist",
    price: "$39.99",
    period: "/mo",
    description: "Built for people who take their land seriously.",
    features: ["Everything in Naturalist","Weekly task checklists","Food plot seed picks","Nesting box placement plans"],
    cta: "Start free trial",
    href: "/onboarding",
    highlighted: false,
  },
];

const ecosystemBenefits = [
  { icon: "🌱", label: "Soil health" },
  { icon: "🦌", label: "Deer & turkey" },
  { icon: "🐦", label: "Bird habitat" },
  { icon: "🌸", label: "Pollinators" },
  { icon: "💧", label: "Water quality" },
  { icon: "🌳", label: "Native plants" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">
            <span style={{ color: "#3B6D11" }}>Land</span>Ethic.io
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="redirect">
                <button className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  Sign in
                </button>
              </SignInButton>
              <Link href="/sign-up" className="text-sm font-medium text-white px-4 py-2 rounded-lg transition-colors" style={{ backgroundColor: "#3B6D11" }}>
                Get started free →
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="text-sm font-medium text-white px-4 py-2 rounded-lg transition-colors" style={{ backgroundColor: "#3B6D11" }}>
                My dashboard →
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full mb-6" style={{ backgroundColor: "#EAF3DE", color: "#3B6D11" }}>
          AI-powered land stewardship
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-gray-900 mb-6 leading-tight">
          Your land.<br />
          <span style={{ color: "#3B6D11" }}>Every species.</span> One plan.
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Put in your address and we will build you a land management plan that covers everything on your property. Soil, native plants, birds, deer, pollinators and more.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/onboarding" className="text-base font-medium text-white px-8 py-3.5 rounded-xl transition-colors" style={{ backgroundColor: "#3B6D11" }}>
            Analyze my property free →
          </Link>
          <a href="#how-it-works" className="text-base font-medium text-gray-600 px-8 py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            See how it works
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-4">No credit card required</p>
        <div className="flex flex-wrap justify-center gap-3 mt-14">
          {ecosystemBenefits.map((b) => (
            <span key={b.label} className="flex items-center gap-2 text-sm px-4 py-2 rounded-full border border-gray-100 bg-gray-50 text-gray-600">
              <span>{b.icon}</span>{b.label}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-gray-900 mb-3">From address to action plan in minutes</h2>
            <p className="text-gray-500 max-w-xl mx-auto">No consultants. No site visits. No complicated setup. Just your address and your goals.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step) => (
              <div key={step.number} className="bg-white rounded-2xl p-8 border border-gray-100">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold mb-5" style={{ backgroundColor: "#EAF3DE", color: "#3B6D11" }}>
                  {step.number}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy callout */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-3xl p-10 md:p-14 text-center" style={{ backgroundColor: "#EAF3DE" }}>
            <h2 className="text-3xl font-semibold mb-4" style={{ color: "#27500A" }}>
              Land management beyond the trophy wall
            </h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed mb-8" style={{ color: "#3B6D11" }}>
              Most land advice focuses on just one animal or one goal. LandEthic.io looks at the whole picture. Healthy soil grows healthy plants. Healthy plants feed insects. Healthy insects feed birds, deer, turkey, and everything else. When you take care of the land, the land takes care of you.
            </p>
            <Link href="/onboarding" className="inline-block text-sm font-semibold text-white px-6 py-3 rounded-xl" style={{ backgroundColor: "#3B6D11" }}>
              Start with your free plan →
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-gray-900 mb-3">Plans for every land manager</h2>
            <p className="text-gray-500">Start for free. Upgrade whenever you want to go deeper.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-white rounded-2xl p-6 flex flex-col ${tier.highlighted ? "border-2" : "border border-gray-100"}`}
                style={tier.highlighted ? { borderColor: "#639922" } : {}}
              >
                {tier.badge && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full self-start mb-3" style={{ backgroundColor: "#EAF3DE", color: "#3B6D11" }}>
                    {tier.badge}
                  </span>
                )}
                <h3 className="text-base font-semibold text-gray-900 mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-semibold text-gray-900">{tier.price}</span>
                  {tier.period && <span className="text-sm text-gray-400">{tier.period}</span>}
                </div>
                <p className="text-xs text-gray-400 mb-5">{tier.description}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-0.5 text-xs font-bold" style={{ color: "#639922" }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`text-sm font-medium text-center py-2.5 rounded-lg transition-colors ${tier.highlighted ? "text-white" : "border border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  style={tier.highlighted ? { backgroundColor: "#3B6D11" } : {}}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">All paid plans include a 14-day free trial. Cancel anytime.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold"><span style={{ color: "#3B6D11" }}>Land</span>Ethic.io</span>
          <p className="text-xs text-gray-400">© 2026 LandEthic.io · All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}

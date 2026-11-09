import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import AppUserButton from "@/components/AppUserButton";
import SiteFooter from "@/components/SiteFooter";
import { ContourLines, Icon, Logo } from "@/components/brand";
import { PLANS, TRIAL_NOTE } from "@/lib/pricing";

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

const ecosystemBenefits = [
  { icon: Icon.Sprout, label: "Soil health" },
  { icon: Icon.Antler, label: "Deer & turkey" },
  { icon: Icon.Bird, label: "Bird habitat" },
  { icon: Icon.Flower, label: "Pollinators" },
  { icon: Icon.Drop, label: "Water quality" },
  { icon: Icon.Leaf, label: "Native plants" },
];

const signedOutLinks = (
  <>
    <Link href="/sign-in" className="whitespace-nowrap text-sm font-medium text-ink-soft transition-colors hover:text-ink">
      Sign in
    </Link>
    <Link href="/sign-up" className="btn-primary whitespace-nowrap !px-3.5 !py-2.5 !text-sm sm:!px-4">
      <span className="sm:hidden">Start free</span>
      <span className="hidden sm:inline">Get started free</span>
    </Link>
  </>
);

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-paper-line bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo size="lg" />
          <div className="hidden items-center gap-9 text-sm font-medium text-ink-soft md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-ink">How it works</a>
            <a href="#pricing" className="transition-colors hover:text-ink">Pricing</a>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <SignedOut>{signedOutLinks}</SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="btn-primary !px-4 !py-2.5 !text-sm">
                My dashboard
              </Link>
              <AppUserButton />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-cream-2 px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-24">
        <ContourLines className="text-forest-700 opacity-[0.16]" />
        <div className="relative mx-auto max-w-3xl">
          <span className="eyebrow mb-7 inline-block rounded-full bg-rust-100 px-4 py-2">
            Field-tested · AI-powered land stewardship
          </span>
          <h1 className="mb-6 text-4xl font-bold leading-[1.08] text-ink sm:text-5xl md:text-6xl">
            Your land.
            <br />
            <span className="relative inline-block text-forest-700">
              Every species.
              <svg viewBox="0 0 260 14" className="absolute -bottom-2 left-0 h-3.5 w-full" aria-hidden="true">
                <path d="M2 9c40-10 80 8 128-2s90 8 128-2" fill="none" stroke="#8F3412" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>{" "}
            One plan.
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-[19px]">
            Put in your address and we will build you a land management plan that covers everything on your
            property. Soil, native plants, birds, deer, pollinators and more.
          </p>
          <div className="mb-4 flex flex-col justify-center gap-3.5 sm:flex-row">
            <Link href="/onboarding" className="btn-primary">
              Analyze my property free
              <Icon.Arrow />
            </Link>
            <a href="#how-it-works" className="btn-outline">See how it works</a>
          </div>
          <p className="text-[13px] text-ink-faint">No credit card required</p>
        </div>
        <div className="relative mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-3.5">
          {ecosystemBenefits.map(({ icon: BenefitIcon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-r-lg border border-l-[3px] border-paper-line border-l-forest-600 bg-cream-2 py-2 pl-3 pr-4 text-[13px] font-medium text-ink-soft"
              style={{ borderLeftStyle: "dashed" }}
            >
              <BenefitIcon className="text-forest-700" />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-[88px]">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="eyebrow">The process</span>
            <h2 className="mb-3 mt-3 text-3xl font-bold text-ink sm:text-[34px]">From address to action plan in minutes</h2>
            <p className="text-base leading-relaxed text-ink-soft">
              No consultants. No site visits. No complicated setup. Just your address and your goals.
            </p>
          </div>
          <div className="grid gap-7 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="card p-8 sm:p-9">
                <div className="mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-forest-700">
                  <span className="font-display text-xl font-bold text-forest-700">{step.number}</span>
                </div>
                <h3 className="mb-2.5 text-lg font-bold text-ink">{step.title}</h3>
                <p className="text-sm leading-[1.65] text-ink-soft">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="px-4 pb-20 sm:px-6 sm:pb-[88px]">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-forest-900 px-6 py-16 text-center sm:px-16 sm:py-[76px]">
          <ContourLines className="text-forest-200 opacity-[0.14]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="mb-5 text-2xl font-bold text-cream sm:text-[32px]">Land management beyond the trophy wall</h2>
            <p className="mb-9 text-base leading-[1.7] text-forest-200 sm:text-[17px]">
              Most land advice focuses on just one animal or one goal. LandEthic.io looks at the whole picture.
              Healthy soil grows healthy plants. Healthy plants feed insects. Healthy insects feed birds, deer,
              turkey, and everything else. When you take care of the land, the land takes care of you.
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-[10px] bg-rust-700 px-7 py-3.5 text-[15px] font-semibold text-cream transition-colors hover:bg-rust-600"
            >
              Start with your free plan
              <Icon.Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-cream-2 px-4 pb-24 pt-20 sm:px-6 sm:pt-[88px]">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <span className="eyebrow">Choose your path</span>
            <h2 className="mb-3 mt-3 text-3xl font-bold text-ink sm:text-[34px]">Plans for every land manager</h2>
            <p className="text-base text-ink-soft">Start for free. Upgrade whenever you want to go deeper.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              const highlighted = Boolean(plan.badge);
              return (
                <div
                  key={plan.tier}
                  className={`card relative flex flex-col p-7 ${highlighted ? "!border-2 !border-rust-700" : ""}`}
                >
                  {plan.badge && (
                    <span className="absolute -top-px right-5 rounded-b-lg bg-rust-700 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-cream">
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="mb-1.5 mt-6 text-[17px] font-bold text-ink">{plan.name}</h3>
                  <div className="mb-1.5 flex items-baseline gap-1">
                    <span className="font-display text-[28px] font-bold text-ink">{plan.price}</span>
                    {plan.period && <span className="text-[13px] text-ink-faint">{plan.period}</span>}
                  </div>
                  <p className="mb-6 text-[13px] text-ink-faint">{plan.tagline}</p>
                  <ul className="mb-7 flex flex-1 flex-col gap-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-ink-soft">
                        <Icon.CheckCircle size={16} className="mt-0.5 flex-shrink-0 text-forest-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/onboarding"
                    className={`${highlighted ? "btn-primary" : "btn-outline"} w-full !py-3`}
                  >
                    {plan.tier === "free" ? "Get started free" : "Start free trial"}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-7 text-center text-[12.5px] text-ink-faint">{TRIAL_NOTE}</p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { BUSINESS_NAME, CONTACT_EMAIL } from '@/lib/legal';
import { DATA_KEEP_DAYS } from '@/lib/pricing';

export const metadata: Metadata = {
  title: 'Privacy Policy — LandEthic.io',
  description: 'What LandEthic.io collects, why, who helps us run the service, and the choices you have.',
};

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

// Every outside company that touches user data. Keep this list in sync with
// the services the app actually calls (see README → Key APIs).
const PROCESSORS: { name: string; href: string; what: string; data: string }[] = [
  { name: 'Clerk', href: 'https://clerk.com/legal/privacy', what: 'Sign-in and account management', data: 'Name, email address, Google profile basics, sign-in activity' },
  { name: 'Stripe', href: 'https://stripe.com/privacy', what: 'Subscription payments and billing', data: 'Payment card and billing details (we never see or store your full card number)' },
  { name: 'Neon', href: 'https://neon.tech/privacy-policy', what: 'Our database', data: 'Your saved properties, plans, tasks, subscription status, and AI usage counts' },
  { name: 'Anthropic (Claude)', href: 'https://www.anthropic.com/legal/privacy', what: 'AI property analysis, plan writing, task questions, and photo identification', data: 'Property details, your goals, your questions, and photos you choose to identify' },
  { name: 'Mapbox', href: 'https://www.mapbox.com/legal/privacy', what: 'Satellite maps and address lookup', data: 'The address you enter and the map area you view' },
  { name: 'Regrid', href: 'https://regrid.com/privacy', what: 'Public property-line (parcel) records', data: 'The map location of your address' },
  { name: 'iNaturalist', href: 'https://www.inaturalist.org/pages/privacy', what: 'Nearby species lists and, when enabled, photo identification', data: 'Approximate map location; photos you choose to identify' },
  { name: 'USDA soil data via UC Davis SoilWeb', href: 'https://casoilresource.lawr.ucdavis.edu/', what: 'Soil type lookup', data: 'The map location of your property' },
  { name: 'phzmapi.org', href: 'https://phzmapi.org/', what: 'USDA plant hardiness zone lookup', data: 'The map location of your property' },
  { name: 'Vercel', href: 'https://vercel.com/legal/privacy-policy', what: 'Hosting the website', data: 'Standard web request logs such as IP address, browser type, and pages requested' },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro={
        <>
          <p>
            {BUSINESS_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps landowners understand their land and build a
            practical stewardship plan. To do that we need some information about you and your property. This page
            explains, in plain language, what we collect, why, who helps us run the service, and the choices you have.
          </p>
          <p>
            <strong>The short version:</strong> we use your information to run LandEthic.io and nothing else. We do not
            sell your personal information, we do not show ads, and we do not share your data with advertisers.
          </p>
        </>
      }
      sections={[
        {
          id: 'what-we-collect',
          title: 'What we collect',
          body: (
            <>
              <h3>Information you give us</h3>
              <ul>
                <li><strong>Account details</strong> — your name, email address, and (if you sign in with Google) basic Google profile information.</li>
                <li><strong>Property details</strong> — the address you enter, the property boundary you confirm or draw, acreage, the goals you pick, and anything you write about your plans for the land.</li>
                <li><strong>Questions and photos</strong> — questions you ask about a task, and photos you upload to identify a plant or animal.</li>
                <li><strong>Problem reports</strong> — if you use &ldquo;Report a problem,&rdquo; what you write, the error you saw, the page you were on, your browser and screen size, and the app&apos;s last few requests, so we can find and fix the problem.</li>
                <li><strong>Billing details</strong> — if you choose a paid plan, your payment details go straight to Stripe. We only keep your Stripe customer ID, which plan you are on, and its status and renewal date.</li>
              </ul>
              <h3>Information we create or collect automatically</h3>
              <ul>
                <li><strong>Your plan</strong> — the land analysis, insights, land health score, and tasks we generate for you, plus which tasks you mark done.</li>
                <li><strong>Usage counts</strong> — a simple log of when you use AI features (for example, building a plan), so we can apply fair monthly limits.</li>
                <li><strong>Technical data</strong> — standard web logs kept by our host, such as IP address, browser type, and the pages you visit.</li>
              </ul>
              <p>
                <strong>Photos:</strong> photos you upload for species ID are shrunk on your device and sent to our
                identification providers to get an answer. The full-size photo is not kept. A small thumbnail and the
                result are saved to your account so you can look back at past identifications; you can remove any of
                them from your field guide at any time.
              </p>
            </>
          ),
        },
        {
          id: 'how-we-use',
          title: 'How we use your information',
          body: (
            <ul>
              <li>To create your account and keep you signed in.</li>
              <li>To look up public information about your land (maps, property lines, soil, hardiness zone, nearby species) and use it to build your plan.</li>
              <li>To answer your questions about tasks and identify species in your photos.</li>
              <li>To run your subscription, including free trials, plan changes, and billing emails from Stripe.</li>
              <li>To keep the service safe and working — for example, applying daily limits, preventing abuse, and fixing errors.</li>
              <li>To reply when you contact us.</li>
            </ul>
          ),
        },
        {
          id: 'who-helps',
          title: 'Companies that help us run LandEthic.io',
          body: (
            <>
              <p>
                We use the outside services below to provide LandEthic.io. Each one only gets the information it needs
                for its job. Their own privacy policies explain how they handle data.
              </p>
              <div className="-mx-1 overflow-x-auto px-1">
                <table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>What it does for us</th>
                      <th>What it receives</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROCESSORS.map((p) => (
                      <tr key={p.name}>
                        <td className="whitespace-nowrap font-medium text-ink">
                          <a href={p.href} target="_blank" rel="noopener noreferrer">{p.name}</a>
                        </td>
                        <td>{p.what}</td>
                        <td>{p.data}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong>About AI:</strong> your property details, goals, questions, and photos are sent to Anthropic&rsquo;s
                Claude models to write your analysis and plan. Under Anthropic&rsquo;s commercial terms, data sent through
                its API is not used to train its models by default.
              </p>
              <p>
                We may also share information if the law requires it, to protect people&rsquo;s safety, or as part of a
                sale or merger of the business (in which case this policy would continue to apply to your information).
              </p>
            </>
          ),
        },
        {
          id: 'browser-storage',
          title: 'Cookies and browser storage',
          body: (
            <>
              <p>
                We use only the cookies needed to keep you signed in (set by Clerk) and to process payments (set by
                Stripe at checkout). We also save a few small items in your browser — such as an unfinished property
                address, and whether you have already seen the map flyover — so the app remembers where you left off.
              </p>
              <p>We do not use advertising cookies or cross-site tracking.</p>
            </>
          ),
        },
        {
          id: 'retention',
          title: 'How long we keep it',
          body: (
            <ul>
              <li>Account, property, and plan information is kept while your account is open.</li>
              <li>If you remove a property, its plan and tasks are deleted with it.</li>
              <li>AI usage counts are only needed for 30 days (to track monthly allowances); we delete older ones.</li>
              <li>If your free plan or paid plan ends and you do not choose a plan, your account is locked. {DATA_KEEP_DAYS} days after that, we automatically delete your properties, plans, tasks, progress, food plot and nest box plans, and photo identifications. Your sign-in account stays so you can start again.</li>
              <li>When you close your account we delete your account and property data, except for records we must keep by law (for example, billing records that Stripe and tax rules require).</li>
            </ul>
          ),
        },
        {
          id: 'your-choices',
          title: 'Your choices and rights',
          body: (
            <>
              <p>You can, at any time:</p>
              <ul>
                <li>Update your name, email, and password from your account menu.</li>
                <li>Change or cancel your plan from <Link href="/upgrade">Manage plan</Link>.</li>
                <li>Ask us for a copy of your data, ask us to correct it, or ask us to delete your account — email <Mail />.</li>
              </ul>
              <p>
                Depending on where you live (for example, California or the European Union), you may have additional
                rights, such as the right to know what we collect and to not be discriminated against for using your
                rights. We do not sell or &ldquo;share&rdquo; personal information as those laws define it. To make a request,
                email <Mail />. We may need to confirm it&rsquo;s really you before we act.
              </p>
            </>
          ),
        },
        {
          id: 'security',
          title: 'Security',
          body: (
            <p>
              We use well-known providers for sign-in, payments, and data storage, send data over encrypted (HTTPS)
              connections, and limit who can access production systems. No online service can promise perfect
              security, so please use a strong, unique password and let us know right away at <Mail /> if you think
              your account has been misused.
            </p>
          ),
        },
        {
          id: 'children',
          title: 'Children',
          body: (
            <p>
              LandEthic.io is meant for adults managing land. It is not directed to children under 13, and we do not
              knowingly collect information from them. If you believe a child has given us information, email <Mail />{' '}
              and we will delete it.
            </p>
          ),
        },
        {
          id: 'changes',
          title: 'Changes to this policy',
          body: (
            <p>
              If we make important changes, we will update the date at the top of this page and, where it makes sense,
              let you know by email or in the app before the changes take effect.
            </p>
          ),
        },
        {
          id: 'contact',
          title: 'Contact us',
          body: (
            <p>
              Questions about privacy? Email <Mail />. You can also read our <Link href="/terms">Terms of Service</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { PLANS, TRIAL_NOTE } from '@/lib/pricing';
import { BUSINESS_NAME, CONTACT_EMAIL, GOVERNING_LAW_STATE } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of Service — LandEthic.io',
  description: 'The rules for using LandEthic.io, how plans and billing work, and important limits on the advice the app gives.',
};

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const paidPlans = PLANS.filter((p) => p.tier !== 'free')
  .map((p) => `${p.name} (${p.price}${p.period ?? ''})`)
  .join(', ');

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      intro={
        <>
          <p>
            These terms are an agreement between you and {BUSINESS_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) for using the
            LandEthic.io website and app (the &ldquo;Service&rdquo;). By creating an account or using the Service, you
            agree to them. If you do not agree, please do not use the Service.
          </p>
          <p>
            <strong>Most important point:</strong> LandEthic.io gives general, AI-generated guidance. It is not
            professional advice, it can be wrong, and you are responsible for checking local rules and staying safe
            before doing any work on your land. Section 3 explains this in more detail.
          </p>
        </>
      }
      sections={[
        {
          id: 'the-service',
          title: 'The Service and your account',
          body: (
            <ul>
              <li>LandEthic.io uses public map, parcel, soil, and wildlife data plus AI to describe your land and suggest a stewardship plan.</li>
              <li>You must be at least 18 years old (or the age of majority where you live) to create an account.</li>
              <li>Keep your sign-in details safe. You are responsible for activity on your account. Tell us at <Mail /> if you think someone else has used it.</li>
              <li>Only add land you own, manage, or have permission to plan for. Adding a property in the app does not give you any right to enter or work on it.</li>
            </ul>
          ),
        },
        {
          id: 'plans-billing',
          title: 'Plans, trials, and billing',
          body: (
            <>
              <ul>
                <li><strong>Free plan.</strong> The Free plan costs nothing and does not need a payment card.</li>
                <li><strong>Paid plans.</strong> Our paid plans are {paidPlans}, billed monthly in U.S. dollars through our payment processor, Stripe. Prices do not include any taxes that may apply.</li>
                <li><strong>Free trial.</strong> {TRIAL_NOTE} The trial applies to your first paid subscription. If you do not cancel before the trial ends, your card will be charged and the subscription renews every month.</li>
                <li><strong>Automatic renewal.</strong> Paid plans renew automatically each month until you cancel.</li>
                <li><strong>Switching plans.</strong> Moving between paid plans takes effect right away, and Stripe adjusts the charge for the rest of the billing period (proration).</li>
                <li><strong>Cancelling.</strong> You can cancel or downgrade to Free any time from <Link href="/upgrade">Manage plan</Link>. You keep your paid features until the end of the period you already paid for. Your land data stays in your account.</li>
                <li><strong>Refunds.</strong> Except where the law requires otherwise, payments are not refundable and we do not give credits for partial months.</li>
                <li><strong>Price changes.</strong> If we change prices, we will tell you in advance. The new price applies from your next billing period after the notice.</li>
                <li><strong>Fair-use limits.</strong> AI features (such as building plans, asking task questions, and identifying species) have daily limits that depend on your plan. If you reach a limit, you can try again the next day.</li>
              </ul>
              <p>
                Plan features are described on our <Link href="/#pricing">pricing page</Link>. We may improve or change
                features over time; if a change takes away something important from a paid plan you are on, we will let
                you know.
              </p>
            </>
          ),
        },
        {
          id: 'guidance',
          title: 'Guidance, not professional advice',
          body: (
            <>
              <p>
                Plans, insights, scores, species IDs, and chat answers in LandEthic.io are created by AI from public data
                and what you tell us. They are general guidance to help you think about your land. They are{' '}
                <strong>not</strong> professional forestry, wildlife, agronomy, engineering, surveying, environmental,
                or legal advice, and they may be incomplete or wrong.
              </p>
              <ul>
                <li><strong>Check local rules first.</strong> Before burning, using herbicides or pesticides, clearing land, or doing any work in or near wetlands, streams, or ponds, check with your local, state, and federal authorities (for example your state forestry or wildlife agency, extension office, or conservation district). Many of these activities need permits, licenses, or follow seasonal restrictions.</li>
                <li><strong>Follow product labels.</strong> Always read and follow the label on any herbicide, pesticide, fertilizer, or seed product. The label instructions come first.</li>
                <li><strong>Boundaries are approximate.</strong> Property lines in the app come from public records or from what you draw. They are not a survey. Confirm your boundaries before building, cutting, fencing, or planting near a line.</li>
                <li><strong>Species IDs can be wrong.</strong> Never eat, handle, or treat a plant, mushroom, or animal based only on an ID from the app.</li>
                <li><strong>Hunting and wildlife.</strong> Follow your state&rsquo;s hunting, baiting, feeding, and protected-species rules.</li>
                <li><strong>Stay safe.</strong> You are responsible for deciding whether, when, and how to do any task, for the safety of you and anyone working with you, and for hiring a qualified professional when a job calls for one.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'acceptable-use',
          title: 'Using the Service fairly',
          body: (
            <>
              <p>Please don&rsquo;t:</p>
              <ul>
                <li>Break the law, or use the Service to plan anything illegal or harmful.</li>
                <li>Try to get around plan limits, daily AI limits, or security measures, or access other people&rsquo;s accounts or data.</li>
                <li>Scrape, copy, resell, or overload the Service, or use automated tools to call it in bulk.</li>
                <li>Upload content you don&rsquo;t have the right to share, or content that is abusive or unlawful.</li>
              </ul>
              <p>We may limit, suspend, or close accounts that break these rules.</p>
            </>
          ),
        },
        {
          id: 'your-content',
          title: 'Your content',
          body: (
            <>
              <p>
                You own the information, text, and photos you put into LandEthic.io. You give us permission to store,
                process, and send them to the service providers listed in our <Link href="/privacy">Privacy Policy</Link>{' '}
                only as needed to run the Service for you.
              </p>
              <p>
                You may use the plans the Service creates for you for your own land and your own purposes. The
                LandEthic.io name, logo, design, and software belong to us.
              </p>
            </>
          ),
        },
        {
          id: 'third-parties',
          title: 'Other services and data',
          body: (
            <p>
              The Service relies on outside providers and public data sources (such as map, parcel, soil, and wildlife
              data). We don&rsquo;t control them and can&rsquo;t promise their data is accurate, complete, or always available.
              Links to other websites are provided for convenience.
            </p>
          ),
        },
        {
          id: 'disclaimers',
          title: 'Disclaimers',
          body: (
            <p>
              To the fullest extent the law allows, the Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;,
              without warranties of any kind, including any warranty that it will meet your needs, be error-free, or that
              any result (such as a change in wildlife, yield, or land health) will happen.
            </p>
          ),
        },
        {
          id: 'liability',
          title: 'Limits on our liability',
          body: (
            <>
              <p>
                To the fullest extent the law allows, {BUSINESS_NAME} will not be liable for any indirect, incidental,
                special, consequential, or punitive damages, or for lost profits, crops, timber, property damage, or
                fines, arising from your use of the Service or from acting on its guidance.
              </p>
              <p>
                Our total liability for any claim about the Service is limited to the amount you paid us in the 12
                months before the claim (or $50 if you have only used the Free plan). Some places don&rsquo;t allow these
                limits, so they may not fully apply to you.
              </p>
              <p>
                You agree to cover us for claims made by others that come from your use of the Service in breach of
                these terms or the law.
              </p>
            </>
          ),
        },
        {
          id: 'ending',
          title: 'Ending the agreement',
          body: (
            <p>
              You can stop using the Service and close your account at any time by emailing <Mail />. We may suspend or
              end your access if you break these terms or if we stop offering the Service; if we shut down the Service
              we will give reasonable notice where we can. Sections that by their nature should continue (such as
              disclaimers and limits on liability) survive after the agreement ends.
            </p>
          ),
        },
        {
          id: 'law-changes',
          title: 'Governing law and changes',
          body: (
            <>
              <p>
                These terms are governed by the laws of{' '}
                {GOVERNING_LAW_STATE ? `the State of ${GOVERNING_LAW_STATE}` : 'the U.S. state where LandEthic.io is based'},
                without regard to conflict-of-law rules, except where the law where you live says otherwise.
              </p>
              <p>
                We may update these terms. If a change is important, we will update the date at the top of this page and
                let you know by email or in the app before it takes effect. Using the Service after that means you accept
                the updated terms.
              </p>
            </>
          ),
        },
        {
          id: 'contact',
          title: 'Contact us',
          body: (
            <p>
              Questions about these terms? Email <Mail />.
            </p>
          ),
        },
      ]}
    />
  );
}

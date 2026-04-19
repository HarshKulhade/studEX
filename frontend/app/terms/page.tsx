'use client';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F7F4EF] overflow-x-hidden w-full">
      {/* Header */}
      <header className="bg-[#F7F4EF] sticky top-0 z-40 flex items-center gap-4 px-6 py-4 border-b border-outline-variant/20">
        <button onClick={() => router.back()} className="text-ink">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <span className="font-headline font-black text-xl tracking-tighter text-ink uppercase">Terms & Conditions</span>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">Effective April 2025 · Version 1.0</div>
        </div>
      </header>

      <main className="px-6 py-8 space-y-8 max-w-2xl mx-auto">

        {/* Intro Banner */}
        <div className="bg-charcoal text-white p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber rotate-45 translate-x-8 -translate-y-8 opacity-80" />
          <div className="relative z-10">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber">StudEX Platform</span>
            <h1 className="font-headline font-black text-3xl uppercase tracking-tighter mt-2 leading-none">Terms and Conditions of Use</h1>
            <p className="font-body text-sm text-white/70 mt-3">
              By accessing or using StudEX, you agree to be bound by these Terms. Please read them carefully before proceeding.
            </p>
          </div>
        </div>

        <Section number="1" title="Introduction and Acceptance">
          <p>Welcome to StudEX — a hyperlocal student discount platform operated in India, designed to connect verified college students with local businesses offering exclusive deals, discounts, and offers within a 2–5 km radius of their campus.</p>
          <p className="mt-3">If you do not agree to these Terms, you must immediately discontinue use of the platform. By continuing to use StudEX, you confirm that you have read, understood, and accepted these Terms in their entirety.</p>
        </Section>

        <Section number="2" title="Definitions">
          <TermList items={[
            { term: '"Platform"', def: 'The StudEX web and mobile application, including all features, tools, content, and services.' },
            { term: '"User" / "Student User"', def: 'Any individual who registers on the Platform as a verified student.' },
            { term: '"Business Partner"', def: 'Any local business or merchant that registers to offer deals to student users.' },
            { term: '"Deal" / "Offer"', def: 'Any discount, promotion, cashback, or time-limited offer listed by a Business Partner.' },
            { term: '"Hyperlocal Radius"', def: 'The geographic zone of approximately 2–5 km surrounding a registered campus.' },
          ]} />
        </Section>

        <Section number="3" title="Eligibility and Registration">
          <h4 className="font-mono text-xs uppercase tracking-widest text-muted mb-2">3.1 Student Eligibility</h4>
          <BulletList items={[
            'Be currently enrolled as a full-time or part-time student at a recognised institution in India.',
            'Be at least 16 years of age at the time of registration.',
            'Provide a valid college email address or institution-issued student ID for verification.',
          ]} />
          <h4 className="font-mono text-xs uppercase tracking-widest text-muted mb-2 mt-4">3.2 Account Accuracy</h4>
          <p>All users represent that the information provided during registration is accurate, current, and complete. StudEX reserves the right to suspend or terminate any account found to contain false or unverifiable information.</p>
        </Section>

        <Section number="4" title="Student Verification">
          <p>StudEX employs a verification process to ensure only genuine enrolled students access student-exclusive deals. By registering, you consent to:</p>
          <BulletList items={[
            'Submitting your college-issued identity card or enrollment details for verification.',
            'Periodic re-verification of your student status.',
            'Revocation of student access upon graduation, withdrawal, or cessation of enrollment.',
          ]} />
          <p className="mt-3 font-bold text-sm">Attempting to fraudulently obtain student verification — including submitting forged documents — constitutes a material breach of these Terms and may result in permanent suspension.</p>
        </Section>

        <Section number="5" title="Platform Use and Conduct">
          <h4 className="font-mono text-xs uppercase tracking-widest text-muted mb-2">5.1 Permitted Use</h4>
          <p>You may use StudEX solely for its intended purpose: discovering and redeeming hyperlocal deals as a verified student, or listing and managing offers as a registered Business Partner.</p>
          <h4 className="font-mono text-xs uppercase tracking-widest text-muted mb-2 mt-4">5.2 Prohibited Conduct</h4>
          <BulletList items={[
            'Sharing or selling your account credentials or verification status to any third party.',
            'Using automated tools, bots, or scrapers to access or copy any part of the Platform.',
            'Attempting to circumvent geographic restrictions or verification mechanisms.',
            'Posting false reviews, fabricated deal claims, or misleading business information.',
            'Harassing, threatening, or engaging in abusive behaviour toward other users or staff.',
            'Using the Platform for any commercial purpose not expressly authorised by StudEX.',
          ]} />
        </Section>

        <Section number="6" title="Deals, Offers, and Redemption">
          <p>All Deals listed on StudEX are provided by Business Partners. StudEX acts as a technology platform and does not itself offer, guarantee, or underwrite any Deal.</p>
          <h4 className="font-mono text-xs uppercase tracking-widest text-muted mb-2 mt-4">Redemption Rules</h4>
          <BulletList items={[
            'Present the claimed offer on the StudEX platform at the point of transaction.',
            'Business Partners may verify student identity before honouring a Deal.',
            'Deals may not be combined with other offers unless explicitly stated.',
            'Deals are non-transferable and valid only for the Student User who claimed them.',
          ]} />
        </Section>

        <Section number="7" title="Business Partner Obligations">
          <BulletList items={[
            'All Deals listed must be genuine, accurate, and honoured during their active period.',
            'Business Partners must notify StudEX promptly if a Deal must be withdrawn early.',
            'Business Partners must not discriminate against any Student User.',
            'You consent to StudEX displaying your business name and promotional content to Student Users.',
          ]} />
        </Section>

        <Section number="8" title="Fees and Payments">
          <div className="bg-surface-container-high rounded-xl p-4">
            <p className="font-mono text-xs uppercase tracking-widest text-muted mb-1">Student Users</p>
            <p className="font-body font-bold text-ink">The core StudEX platform is <span className="text-green-700">free</span> for verified Student Users. No fees are charged for accessing, browsing, or claiming Deals.</p>
          </div>
          <p className="mt-4 text-sm">Business Partners are subject to listing fees, featured promotion fees, campaign fees, and transaction commissions. All fees are quoted inclusive of applicable GST. StudEX reserves the right to revise its fee structure with 30 days' prior written notice.</p>
        </Section>

        <Section number="9" title="Intellectual Property">
          <p>All intellectual property rights in and to the StudEX Platform — including the StudEX name, logo, interface design, software, data, and content — are the exclusive property of StudEX and its founders. Users are granted a limited, non-exclusive, revocable licence to use the Platform in accordance with these Terms.</p>
        </Section>

        <Section number="10" title="Privacy and Data">
          <BulletList items={[
            'Collection of your name, contact details, college information, and location data to personalise the hyperlocal deal experience.',
            'Aggregated and anonymised usage data may be shared with Business Partners as analytics. Individually identifiable data is not shared without your consent.',
            'Location data is processed in real time to surface relevant Deals. You may disable location access at the device level.',
            'StudEX does not sell your personal data to third-party advertisers.',
          ]} />
        </Section>

        <Section number="11" title="Disclaimer of Warranties">
          <p>The StudEX Platform is provided on an "as is" and "as available" basis. StudEX expressly disclaims all warranties, including warranties of merchantability, fitness for a particular purpose, or non-infringement. StudEX does not warrant that any Deal will be available, valid, or honoured at the time of attempted redemption.</p>
        </Section>

        <Section number="12" title="Limitation of Liability">
          <p>To the maximum extent permitted by Indian law, StudEX shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform. Where liability cannot be excluded, StudEX's total liability shall not exceed the fees paid by that user in the three months preceding the event.</p>
        </Section>

        <Section number="13" title="Termination">
          <p>StudEX reserves the right to suspend or permanently terminate your access at any time, with or without notice, for breach of these Terms, fraudulent conduct, inability to verify your student status, or inactivity for 18+ months. Upon termination, your right to access and use the Platform ceases immediately.</p>
        </Section>

        <Section number="14" title="Governing Law and Dispute Resolution">
          <p>These Terms are governed by the laws of India. Disputes not resolved through good-faith negotiation (30 days) shall be submitted to binding arbitration under the Arbitration and Conciliation Act, 1996. The seat of arbitration is <strong>Indore, Madhya Pradesh, India</strong>.</p>
        </Section>

        <Section number="15" title="Modifications to These Terms">
          <p>StudEX reserves the right to modify these Terms at any time. When material changes are made, users will be notified via the Platform or by email at least 14 days before the changes take effect. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.</p>
        </Section>

        <Section number="16" title="Contact Information">
          <div className="bg-surface-container-high rounded-xl p-5 space-y-1">
            <p className="font-headline font-bold text-lg uppercase text-ink">StudEX</p>
            <p className="font-body text-sm text-muted">Student Discount Platform · Hackathon 2025</p>
            <p className="font-body text-sm text-muted">Indore, Madhya Pradesh, India</p>
            <p className="font-mono text-xs text-muted mt-2 uppercase tracking-wider">Team: Atharva Jaiswal · Harsh Garhewal · Sidhatva Jain · Shivani Singh</p>
          </div>
        </Section>

        {/* Footer note */}
        <div className="border-t border-outline-variant/30 pt-6 pb-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            — End of Terms and Conditions — · Effective April 2025
          </p>
        </div>

      </main>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container-lowest editorial-shadow p-6 rounded-2xl space-y-3">
      <div className="flex items-start gap-3">
        <span className="font-mono text-xs font-bold text-amber bg-ink px-2 py-1 rounded-md flex-shrink-0">{number}</span>
        <h2 className="font-headline font-bold text-lg uppercase tracking-tight text-ink leading-tight">{title}</h2>
      </div>
      <div className="font-body text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant/20 pt-3">
        {children}
      </div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 mt-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-amber font-bold flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TermList({ items }: { items: { term: string; def: string }[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border-b border-outline-variant/20 pb-3 last:border-0 last:pb-0">
          <p className="font-mono text-xs font-bold text-ink">{item.term}</p>
          <p className="text-sm mt-0.5">{item.def}</p>
        </div>
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "InsureIT Privacy Policy",
  description: "Privacy Policy for the InsureIT platform operated by Sankalp Insurance Brokers Private Limited.",
};

const sections = [
  {
    title: "Information we collect",
    body:
      "Depending on the service you use, InsureIT may process identity and contact details, customer and account information, vehicle and registration details, insurance policy and renewal information, claim and accident details, driver and licence information, financial or settlement references, uploaded documents, photographs or videos, support communications, authentication data, technical logs, and location information when a feature requires it.",
  },
  {
    title: "How we use information",
    body:
      "We use information to operate and secure accounts, provide insurance quotation and policy assistance, support customer onboarding and KYC, manage vehicles and renewals, register and assist with claims, coordinate documents and survey or repair workflows, provide support, send service notifications, prevent fraud, maintain audit records, comply with applicable legal or regulatory obligations, and improve the platform.",
  },
  {
    title: "Sharing",
    body:
      "We do not sell personal information. Information may be shared where necessary with insurers, authorized insurance partners, surveyors, garages or repairers, claim service providers, technology and cloud providers, payment or financial service providers, authorized staff, and legal, regulatory, or government authorities.",
  },
  {
    title: "Location, media, and documents",
    body:
      "The mobile app may request location, camera, photo/media, document, or notification access for features such as accident reporting, claim evidence, vehicle or policy documents, field verification, and service notifications. Permissions can be managed from device settings, although disabling them may limit related features.",
  },
  {
    title: "Security and retention",
    body:
      "We use authentication, role-based access, database security controls, private document storage, encrypted transport where supported, audit logging, access restrictions, and operational security measures. Information is retained only as long as necessary for service, legal, insurance, tax, audit, fraud-prevention, dispute, and regulatory purposes.",
  },
  {
    title: "Your rights",
    body:
      "Subject to applicable law, you may request access, correction, updating, deletion, consent withdrawal, information about relevant sharing, or grievance handling. Some requests may be limited where records must be retained for an active claim, legal obligation, regulatory requirement, security, fraud prevention, audit, or dispute resolution.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#F4F9FF] px-5 py-10 text-[#17202F]">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-[#D7E6F5] bg-white p-6 shadow-[0_24px_70px_rgba(11,55,105,0.12)] sm:p-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0B63CE]">InsureIT Legal</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#071D49]">Privacy Policy</h1>
        <p className="mt-2 text-xs font-semibold text-[#6A788C]">Effective 04 July 2026 · Last updated 31 August 2026</p>

        <div className="mt-6 rounded-2xl border border-[#DCE8F4] bg-[#F8FBFF] p-5 text-sm leading-6 text-[#46566B]">
          <p><strong>Sankalp Insurance Brokers Private Limited</strong> operates the InsureIT platform.</p>
          <p className="mt-2">CIN: U66220HR2025PTC137800</p>
          <p>Registered Office: A-1414, DLF City Ph I, Golf Course Road DLF QE, Gurgaon, Haryana, India - 122002</p>
          <p>Privacy contact: <a className="font-bold text-[#0B63CE]" href="mailto:insureit@frontiergroup.in">insureit@frontiergroup.in</a></p>
        </div>

        <p className="mt-6 text-sm leading-7 text-[#46566B]">
          This Privacy Policy explains how Sankalp Insurance Brokers Private Limited collects, uses, stores, shares,
          and protects personal information when users access the InsureIT mobile application, web portal, insurance
          assistance, claim support, document, notification, and related services.
        </p>

        <div className="mt-7 space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-black text-[#071D49]">{section.title}</h2>
              <p className="mt-2 text-sm leading-7 text-[#46566B]">{section.body}</p>
            </section>
          ))}

          <section>
            <h2 className="text-lg font-black text-[#071D49]">Account deletion</h2>
            <p className="mt-2 text-sm leading-7 text-[#46566B]">
              InsureIT customer app users can request deletion from inside the app through
              <strong> Profile → Account & Privacy → Request account deletion</strong>, or outside the app through
              the public account-deletion page. We may verify identity before processing the request.
              Account-linked personal data that is no longer required will be deleted or anonymized as appropriate.
              Certain policy, claim, payment, fraud-prevention, audit, tax, legal, or regulatory records may need to
              be retained for a lawful period. Where retention is required, access will be restricted and the
              information will not be retained merely to continue the app account.
            </p>
            <Link href="/account-deletion" className="mt-3 inline-flex font-extrabold text-[#0B63CE]">
              Open account deletion instructions
            </Link>
          </section>

          <section>
            <h2 className="text-lg font-black text-[#071D49]">Children</h2>
            <p className="mt-2 text-sm leading-7 text-[#46566B]">
              The platform is not intended for children below 18. Child-related nominee, beneficiary, dependent, or
              insured-member information is processed only where relevant to an insurance purpose and with appropriate
              authority or consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-[#071D49]">Policy updates and contact</h2>
            <p className="mt-2 text-sm leading-7 text-[#46566B]">
              This policy may be updated when laws, services, technology, security controls, or business practices
              change. Privacy questions, requests, complaints, and account-deletion matters can be sent to
              <a className="ml-1 font-bold text-[#0B63CE]" href="mailto:insureit@frontiergroup.in">insureit@frontiergroup.in</a>.
            </p>
          </section>
        </div>

      </article>
    </main>
  );
}

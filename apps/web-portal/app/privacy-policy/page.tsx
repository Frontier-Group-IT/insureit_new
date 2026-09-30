import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "INSUREIT Partner Privacy Policy",
  description:
    "Privacy Policy for the INSUREIT Partner mobile application and related INSUREIT services operated by Sankalp Insurance Brokers Private Limited.",
};

const privacyEmail = "insureit@frontiergroup.in";

const sections = [
  {
    title: "Information we collect",
    body:
      "Depending on the service you use, INSUREIT may process account and profile details, contact information, Partner/POSP/MISP identifiers, customer and lead information, vehicle and registration details, insurance policy and renewal information, claim and accident details, settlement or payment references, uploaded documents, support communications, authentication data, notification information, app/device diagnostics, and technical logs. Identity or KYC documents are processed only when they are submitted for an authorised insurance, compliance, claim, or onboarding workflow.",
  },
  {
    title: "How we use information",
    body:
      "We use information to operate and secure accounts, authenticate users, enforce role-based access, support insurance onboarding and servicing, manage vehicles and renewals, register and assist with claims, coordinate documents, provide support and service notifications, prevent misuse or fraud, maintain audit records, comply with applicable legal or regulatory obligations, and improve the reliability and performance of the platform.",
  },
  {
    title: "Sharing",
    body:
      "We do not sell personal information. Information may be shared only where reasonably necessary with insurers, authorised insurance intermediaries and service partners, surveyors, garages or repairers, claim service providers, technology and cloud providers, authorised staff, professional advisers, and legal, regulatory, judicial, or government authorities. Technology providers used to operate INSUREIT may include Supabase for authentication, database and storage services, Expo for app delivery and notifications, and Vercel for web hosting.",
  },
  {
    title: "Device features and permissions",
    body:
      "The INSUREIT Partner app may request access to device features only when a feature needs them, for example notifications or selecting a document from the device. Permissions can be managed from device settings. If biometric unlock is enabled, biometric verification is performed by the device operating system; INSUREIT does not receive or store the user's fingerprint, face template, or other biometric template.",
  },
  {
    title: "Security and retention",
    body:
      "We use authentication, role-based access, database security controls, controlled document storage, encrypted network transport, secure session handling, audit logging, and operational access restrictions. Information is retained only as long as reasonably necessary for service, legal, insurance, tax, audit, fraud-prevention, dispute, contractual, and regulatory purposes. Certain policy, claim, payment, KYC, compliance, and audit records may need to be retained after an account is closed.",
  },
  {
    title: "Your rights and choices",
    body:
      "Subject to applicable law and the nature of the record, you may request access, correction, updating, deletion, consent withdrawal, or grievance handling. Some requests may be limited where records must be retained for an active insurance service, claim, legal obligation, regulatory requirement, security, fraud prevention, audit, tax, or dispute resolution purpose.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#F4F9FF] px-4 py-8 text-[#17202F] sm:px-6 sm:py-12">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[30px] border border-[#D7E6F5] bg-white shadow-[0_24px_70px_rgba(11,55,105,0.12)]">
        <header className="border-b border-[#E4ECF5] bg-gradient-to-br from-[#071D49] via-[#0A3474] to-[#0B63CE] px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#B9D8FF]">INSUREIT Partner</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#D8E9FF]">
            How we collect, use, protect, retain, and share information when you use the INSUREIT Partner app and related services.
          </p>
          <p className="mt-5 text-xs font-bold text-[#B9D8FF]">Effective 30 September 2026</p>
        </header>

        <div className="px-6 py-7 sm:px-10 sm:py-9">
          <section className="rounded-2xl border border-[#DCE8F4] bg-[#F8FBFF] p-5 text-sm leading-6 text-[#46566B]">
            <p><strong>Sankalp Insurance Brokers Private Limited</strong> operates the INSUREIT platform.</p>
            <p className="mt-2">CIN: U66220HR2025PTC137800</p>
            <p>Registered Office: A-1414, DLF City Ph I, Golf Course Road DLF QE, Gurgaon, Haryana, India - 122002</p>
            <p>
              Privacy contact:{" "}
              <a className="font-bold text-[#0B63CE]" href={`mailto:${privacyEmail}`}>
                {privacyEmail}
              </a>
            </p>
          </section>

          <section className="mt-6 rounded-2xl border border-[#CFE1F5] bg-[#F6FAFF] p-5">
            <h2 className="text-base font-extrabold text-[#071D49]">This policy applies to INSUREIT Partner</h2>
            <p className="mt-2 text-sm leading-6 text-[#46566B]">
              This Privacy Policy specifically covers the <strong>INSUREIT Partner</strong> Android application
              (package <strong>com.insureit.partner</strong>) and also applies to related INSUREIT web and service
              workflows used with that app. It is publicly available without requiring an INSUREIT login.
            </p>
          </section>

          <p className="mt-6 text-sm leading-7 text-[#46566B]">
            This Privacy Policy explains how Sankalp Insurance Brokers Private Limited collects, uses, stores, shares,
            and protects personal information when authorised Partners, team members, customers, or other users interact
            with INSUREIT services.
          </p>

          <div className="mt-7 space-y-7">
            {sections.map((section) => (
              <section key={section.title} className="border-b border-[#E9EFF6] pb-7 last:border-b-0 last:pb-0">
                <h2 className="text-lg font-black text-[#071D49]">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-[#46566B]">{section.body}</p>
              </section>
            ))}

            <section className="border-b border-[#E9EFF6] pb-7">
              <h2 className="text-lg font-black text-[#071D49]">Account and data requests</h2>
              <p className="mt-2 text-sm leading-7 text-[#46566B]">
                For privacy, correction, or deletion requests, email{" "}
                <a className="font-bold text-[#0B63CE]" href={`mailto:${privacyEmail}`}>
                  {privacyEmail}
                </a>
                . We may need to verify the request before acting on it. Do not send Aadhaar, PAN, policy documents,
                claim documents, passwords, or other sensitive files by ordinary email unless our team specifically
                asks for them through an appropriate secure channel.
              </p>
              <Link href="/account-deletion" className="mt-3 inline-flex font-extrabold text-[#0B63CE]">
                Open account deletion information
              </Link>
            </section>

            <section className="border-b border-[#E9EFF6] pb-7">
              <h2 className="text-lg font-black text-[#071D49]">Children</h2>
              <p className="mt-2 text-sm leading-7 text-[#46566B]">
                INSUREIT Partner is a business application intended for authorised adults and is not directed to
                children. Child-related nominee, beneficiary, dependent, or insured-member information is processed
                only where relevant to a legitimate insurance purpose and with appropriate authority or consent.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-[#071D49]">Policy updates and contact</h2>
              <p className="mt-2 text-sm leading-7 text-[#46566B]">
                We may update this policy when laws, services, technology, security controls, or business practices
                change. The current version will remain published at this URL with an updated effective date. Privacy
                questions, requests, complaints, and account-deletion matters can be sent to{" "}
                <a className="font-bold text-[#0B63CE]" href={`mailto:${privacyEmail}`}>
                  {privacyEmail}
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}

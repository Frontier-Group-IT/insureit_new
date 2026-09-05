import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "InsureIT Account Deletion",
  description: "Request deletion of an InsureIT customer account and associated personal data.",
};

const deletionEmailAddress = "insureit@frontiergroup.in";
const deletionEmail =
  "mailto:insureit@frontiergroup.in?subject=InsureIT%20account%20deletion%20request&body=Please%20delete%20my%20InsureIT%20account%20and%20associated%20personal%20data.%0A%0ARegistered%20mobile%20number%3A%20%0ARegistered%20email%3A%20%0AName%3A%20";
const deletionGmail =
  "https://mail.google.com/mail/?view=cm&fs=1&to=insureit%40frontiergroup.in&su=InsureIT%20account%20deletion%20request&body=Please%20delete%20my%20InsureIT%20account%20and%20associated%20personal%20data.%0A%0ARegistered%20mobile%20number%3A%20%0ARegistered%20email%3A%20%0AName%3A%20";

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-[#F4F9FF] px-5 py-10 text-[#17202F]">
      <div className="mx-auto max-w-2xl rounded-[28px] border border-[#D7E6F5] bg-white p-6 shadow-[0_24px_70px_rgba(11,55,105,0.12)] sm:p-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0B63CE]">InsureIT Account & Privacy</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#071D49]">Request account deletion</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#59687A]">
          Customers can request deletion of their InsureIT app account and associated personal data from inside the
          InsureIT mobile app or by using one of the request options below.
        </p>

        <section className="mt-7 rounded-2xl border border-[#DCE8F4] bg-[#F8FBFF] p-5">
          <h2 className="text-base font-extrabold text-[#071D49]">How to request deletion</h2>
          <ol className="mt-3 space-y-3 text-sm leading-6 text-[#46566B]">
            <li><strong>In the app:</strong> Profile → Account & Privacy → Request account deletion.</li>
            <li><strong>Outside the app:</strong> email <strong>{deletionEmailAddress}</strong> from your registered email address where possible.</li>
          </ol>
        </section>

        <section className="mt-5 rounded-2xl border border-[#F0D2D2] bg-[#FFF8F8] p-5">
          <h2 className="text-base font-extrabold text-[#8F2D2D]">What happens to your data</h2>
          <p className="mt-2 text-sm leading-6 text-[#665454]">
            We verify the request before processing it. Account-linked personal data that is no longer required will
            be deleted. Certain policy, claim, payment, fraud-prevention, audit, tax, legal, or regulatory records may
            need to be retained for a lawful period. Where retention is required, access is restricted and the data is
            not retained merely to continue your app account.
          </p>
        </section>

        <a
          href={deletionGmail}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#C43838] px-5 text-center text-sm font-extrabold text-white"
        >
          Open deletion request in Gmail
        </a>

        <a
          href={deletionEmail}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#D7E6F5] bg-white px-5 text-center text-sm font-extrabold text-[#0B63CE]"
        >
          Open in your email app
        </a>

        <div className="mt-4 rounded-xl border border-[#DCE8F4] bg-[#F8FBFF] p-4 text-sm leading-6 text-[#46566B]">
          <p className="font-bold text-[#071D49]">If neither button opens:</p>
          <p>
            Send an email to <strong>{deletionEmailAddress}</strong> with the subject <strong>InsureIT account deletion request</strong> and include your registered mobile number or email address so we can verify the account.
          </p>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#6A788C]">
          Do not email copies of Aadhaar, PAN, policy documents, claim documents, or other sensitive files unless our
          team specifically asks for them through a secure channel.
        </p>

        <div className="mt-7 border-t border-[#E4ECF5] pt-5 text-sm">
          <Link href="/privacy-policy" className="font-bold text-[#0B63CE]">Privacy Policy</Link>
          <span className="px-2 text-[#A1ADBC]">•</span>
          <a href={deletionEmail} className="font-bold text-[#0B63CE]">Privacy contact</a>
        </div>
      </div>
    </main>
  );
}

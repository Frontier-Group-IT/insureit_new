import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Learner Verification | InsureIT",
  description: "Mobile-friendly certificate and learner details page.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type VerificationRecord = {
  name: string;
  certificateId: string;
  course: string;
  completionDate: string;
  email: string;
  studyTime: string;
  assessmentScore: string;
  cpdHours: string;
  courseDescription: string;
  modules: string[];
};

const defaultModules = [
  "Introduction to Kaizen Philosophy and Concepts",
  "The Elements of Kaizen Process",
  "The Kaizen Event, Story and its Evaluation",
  "Course assessment",
];

function first(value: string | string[] | undefined, fallback: string) {
  const resolved = Array.isArray(value) ? value[0] : value;
  const trimmed = resolved?.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeScore(value: string) {
  const cleaned = value.replace(/%/g, "").trim();
  if (!cleaned) return "80%";
  return `${cleaned}%`;
}

function readRecord(params: Record<string, string | string[] | undefined>): VerificationRecord {
  const modulesRaw = first(params.m ?? params.modules, defaultModules.join("|"));
  const modules = modulesRaw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  return {
    name: first(params.n ?? params.name, "Deepak Sen"),
    certificateId: first(params.id ?? params.certificateId, "17391246"),
    course: first(
      params.c ?? params.course,
      "Kaizen Approach - Lean Methodology for Continuous Improvement",
    ),
    completionDate: first(params.d ?? params.date, "11th August 2022"),
    email: first(params.e ?? params.email, "deepaksen138@gmail.com"),
    studyTime: first(params.t ?? params.studyTime, "0h 29m"),
    assessmentScore: normalizeScore(first(params.s ?? params.score, "80")),
    cpdHours: first(params.h ?? params.cpd, "0-1h"),
    courseDescription: first(
      params.desc ?? params.description,
      "Learn how to develop a streamlining Kaizen cultural change in your company with a practical continuous-improvement learning programme.",
    ),
    modules: modules.length ? modules : defaultModules,
  };
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return <span aria-hidden="true">{initials || "LR"}</span>;
}

export default async function CertificateVerificationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const record = readRecord(params);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <a className={styles.brand} href="/" aria-label="InsureIT home">
            <span className={styles.brandMark}>I</span>
            <span>InsureIT</span>
          </a>
          <span className={styles.headerLabel}>Learning Verification</span>
        </div>
      </header>

      <section className={styles.shell}>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}>Certificate record</p>
            <h1>Your Learner Verification</h1>
            <p className={styles.intro}>
              This page displays the learner and course information encoded in the certificate verification link.
            </p>
          </div>
          <div className={styles.linkStatus}>
            <span className={styles.statusDot} />
            Certificate link opened
          </div>
        </div>

        <article className={styles.card} aria-label="Learner details">
          <div className={styles.cardMain}>
            <div className={styles.avatar}>
              <Initials name={record.name} />
            </div>
            <div className={styles.identity}>
              <h2>{record.name}</h2>
              <dl className={styles.details}>
                <div>
                  <dt>Certificate ID</dt>
                  <dd>{record.certificateId}</dd>
                </div>
                <div>
                  <dt>Course completed</dt>
                  <dd>{record.course}</dd>
                </div>
                <div>
                  <dt>Date of completion</dt>
                  <dd>{record.completionDate}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{record.email}</dd>
                </div>
                <div>
                  <dt>Total study time</dt>
                  <dd>{record.studyTime}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Final Assessment Score</span>
              <strong>{record.assessmentScore}</strong>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>CPD Hours Completed</span>
              <strong>{record.cpdHours}</strong>
            </div>
          </div>
        </article>

        <section className={styles.contentSection}>
          <h2>Course Information</h2>
          <p>{record.courseDescription}</p>
          <p>
            Kaizen is a continuous-improvement approach built around small, practical changes, team participation,
            process review and regular evaluation. This learner record summarises the course details supplied by the
            certificate link.
          </p>
        </section>

        <section className={styles.contentSection}>
          <h2>Modules Completed</h2>
          <ol className={styles.moduleList}>
            {record.modules.map((module, index) => (
              <li key={`${module}-${index}`}>
                <span className={styles.moduleNumber}>{index + 1}</span>
                <span>{module}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className={styles.notice}>
          <strong>Privacy note</strong>
          <span>
            Certificate links can contain personal information. Share the QR code or verification link only with people
            who need to view the learner record.
          </span>
        </aside>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <strong>InsureIT Learning</strong>
            <p>Certificate verification page</p>
          </div>
          <div className={styles.footerLinks}>
            <a href="/">Home</a>
            <a href="mailto:support@insureit.in">Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

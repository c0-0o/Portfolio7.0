import type { ReactNode } from "react";
import { BackToWorkLink, SectionLabel, SiteShell } from "./site";
import { CaseStudyImage } from "./CaseStudyImage";

const ROOT = "/case-studies/irevise";

function SectionIntro({
  label,
  title,
  children,
  dark = false,
}: {
  label: string;
  title: ReactNode;
  children?: ReactNode;
  dark?: boolean;
}) {
  const hasChildren = children !== undefined && children !== null;

  return (
    <div className={`grid gap-5 ${hasChildren ? "md:grid-cols-[1fr_0.8fr] md:items-end md:gap-14" : ""}`}>
      <div className="flex flex-col gap-4">
        <SectionLabel tone={dark ? "lime" : "muted"}>{label}</SectionLabel>
        <h2 className={`text-[clamp(32px,4.4vw,58px)] leading-[1.03] ${dark ? "text-paper" : ""}`}>{title}</h2>
      </div>
      {hasChildren && (
        <div className={`text-base leading-[1.7] md:text-lg ${dark ? "text-soft" : "text-muted"}`}>{children}</div>
      )}
    </div>
  );
}

const roles = [
  {
    label: "01 / TEACHERS",
    title: "LESS ADMIN. MORE TEACHING.",
    body: (
      <>
        Reviews asked for classroom oversight, student tracking, and tools to create and reuse assessments.
        <br />
        <b className="text-ink">Design response:</b> a classroom dashboard and a guided create → assign → grade workflow.
      </>
    ),
  },
  {
    label: "02 / STUDENTS",
    title: "A REASON TO COME BACK.",
    body: (
      <>
        Feedback highlighted limited content and unclear value. Research proposed visible progress and rewards to support return visits.
        <br />
        <b className="text-ink">Design response:</b> quick study entry points, assigned work, streaks, and result feedback.
      </>
    ),
  },
  {
    label: "03 / PARENTS",
    title: "PROGRESS THEY CAN SEE.",
    body: (
      <>
        Parents help decide whether a subscription is worthwhile. Research identified a need for clearer learning progress.
        <br />
        <b className="text-ink">Opportunity:</b> child progress, completed tasks, and weekly summaries. A dedicated parent journey remains future work.
      </>
    ),
  },
];

const teacherSteps = [
  ["01 / CREATE", "Choose full paper or MCQ. Set the level, subject, and test details."],
  ["02 / BUILD", "Write questions or use resources. Add answers and marks."],
  ["03 / ASSIGN", "Preview the assessment and assign it to a class or student."],
  ["04 / REVIEW", "Track submissions, add feedback, and publish results."],
];

const studentSteps = [
  ["01 / JOIN", "Choose subjects and connect to a teacher’s class using a code."],
  ["02 / STUDY", "Find past papers, notes, videos, and community questions."],
  ["03 / SUBMIT", "Take an assigned MCQ or upload a written-paper response."],
  ["04 / REFLECT", "Review results and teacher feedback before the next session."],
];

const roleJourneys: { title: string; steps: string[][] }[] = [
  { title: "TEACHER / PREPARE, ASSIGN, RESPOND", steps: teacherSteps },
  { title: "STUDENT / FIND, PRACTISE, REFLECT", steps: studentSteps },
];

const learningScreens = [
  {
    src: "ir-phone-dashboard-v2.webp",
    alt: "Student dashboard",
    label: "01 / START WITH A FOCUS",
    text: "Streaks and task summaries make activity visible. Study-mode cards give a clear starting point without asking students to search the whole platform.",
  },
  {
    src: "ir-phone-resources-v2.webp",
    alt: "Student resource library",
    label: "02 / ORGANISE THE RESOURCES",
    text: "Past papers, notes, videos, and Ask & Share have recognisable destinations. Subject-led discovery responds to the difficulty of finding relevant material.",
  },
  {
    src: "ir-phone-results-v2.webp",
    alt: "Student assessment results",
    label: "03 / MAKE FEEDBACK USEFUL",
    text: "Results connect scores with teacher feedback and the next practice opportunity. The aim is to make progress understandable, not just display a number.",
  },
];

export default function IReviseContent() {
  return (
    <SiteShell activePage="projects">
      <section className="px-6 pt-8 pb-14 sm:px-10 md:pt-14 md:pb-20">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <BackToWorkLink label="BACK TO ALL WORK" />
            <SectionLabel>01 / CLIENT WORK • EDTECH</SectionLabel>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_0.82fr] lg:items-end">
            <div className="flex flex-col gap-3">
              <h1 className="text-[clamp(52px,9vw,112px)] leading-none">IREVISE.</h1>
              <p className="font-display text-[clamp(26px,3.8vw,46px)] leading-[1.02] text-moss">
                LESS FRICTION.<br />MORE LEARNING.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-lg leading-relaxed text-ink">
                Connecting teacher-created assessments with student practice, feedback, and progress.
              </p>
              <p className="text-base leading-relaxed text-muted">
                A client project exploring a clearer learning experience for Junior and Leaving Certificate exam preparation.
              </p>
              <p className="text-sm leading-relaxed text-muted">
                UX research / Product design<br />
                Desktop &amp; mobile / Teacher &amp; student journeys
              </p>
            </div>
          </div>

          <CaseStudyImage
            src={`${ROOT}/ir-hero-showcase-v2.webp`}
            alt="iRevise teacher and student learning platform screens"
            aspectRatio="1296 / 839"
            loading="eager"
            className="hidden md:block"
          />
          <div className="flex flex-col gap-4 rounded-2xl bg-ink p-5 text-paper md:hidden">
            <SectionLabel tone="lime">ACTUAL PROJECT SCREENS / TEACHER + STUDENT</SectionLabel>
            <CaseStudyImage
              src={`${ROOT}/ir-d-teacher.webp`}
              alt="iRevise teacher dashboard screen"
              aspectRatio="1400 / 996"
              fit="contain"
              className="bg-white"
              loading="eager"
            />
            <div className="grid grid-cols-2 gap-3">
              <CaseStudyImage
                src={`${ROOT}/ir-m-teacher.webp`}
                alt="iRevise teacher mobile screen"
                aspectRatio="393 / 852"
                fit="contain"
                className="bg-white"
              />
              <CaseStudyImage
                src={`${ROOT}/ir-m-student.webp`}
                alt="iRevise student mobile screen"
                aspectRatio="393 / 852"
                fit="contain"
                className="bg-white"
              />
            </div>
            <p className="text-sm text-soft">Create → Assign → Practise → Review</p>
          </div>

          <p className="text-sm leading-relaxed text-muted">
            Product screens contain illustrative sample records. The numbers shown are not measured project outcomes.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["THE CHALLENGE", "Make platform value clearer and connect fragmented study and classroom tasks."],
              ["THE RESPONSE", "Role-based dashboards, guided assessments, and structured learning resources."],
              ["THE EVIDENCE", "Review synthesis, a competitor audit, journey mapping, and interface designs."],
            ].map(([label, text]) => (
              <article key={label} className="rounded-xl border border-line bg-paper p-5">
                <p className="mb-2 text-xs font-bold tracking-widest text-moss">{label}</p>
                <p className="leading-relaxed text-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mist px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
          <SectionIntro
            label="02 / RESEARCH & OPPORTUNITY"
            title={<>THREE AUDIENCES. ONE CONNECTED LEARNING LOOP.</>}
          >
            The problem was not simply a lack of features. People needed a clearer reason to use—and keep using—the platform.
            <br /><br />
            I reviewed the student, teacher, and parent feedback, audited the existing experience, and compared how Studyclix supports exam preparation.
          </SectionIntro>
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-ink px-5 py-5 text-paper sm:px-8">
            {[["01", "Teachers"], ["02", "Students"], ["03", "Parents"]].map(([number, label]) => (
              <div key={label}>
                <p className="font-display text-4xl text-lime md:text-5xl">{number}</p>
                <p className="mt-1 text-xs text-soft sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {roles.map((role) => (
              <article key={role.label} className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-5">
                <p className="text-xs font-bold tracking-widest text-moss">{role.label}</p>
                <h3 className="text-xl leading-tight">{role.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{role.body}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <article>
              <p className="mb-2 text-xs font-bold tracking-widest text-moss">WHAT THE AUDIT REVEALED</p>
              <h3 className="mb-2 text-xl">Too many choices before a clear starting point.</h3>
              <p className="text-sm leading-relaxed text-muted">The notes describe unclear subscription benefits, long animated journeys, difficult content discovery, and resources that appeared empty or broken.</p>
            </article>
            <article>
              <p className="mb-2 text-xs font-bold tracking-widest text-moss">WHAT I TOOK FROM STUDYCLIX</p>
              <h3 className="mb-2 text-xl">Clarity before decoration.</h3>
              <p className="text-sm leading-relaxed text-muted">The competitor review favoured structured categories, useful onboarding, accessible study content, and less distracting motion. I used these as principles—not a template to copy.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-ink px-6 py-14 text-paper sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
          <SectionIntro dark label="03 / FROM RESEARCH TO STRUCTURE" title={<>DIFFERENT ROLES. A CLEAR NEXT STEP.</>}>
            I separated teaching and learning tasks, then mapped how one person’s action becomes another person’s next step.
          </SectionIntro>
          <div className="rounded-xl bg-[#20271b] p-5 sm:p-7">
            <p className="mb-2 text-xs font-bold tracking-widest text-lime">START WITH RELEVANCE</p>
            <h3 className="text-xl leading-snug sm:text-2xl">Choose a role → Set academic level &amp; subjects → Enter a relevant workspace</h3>
            <p className="mt-3 text-sm leading-relaxed text-soft">Subject and level choices reduce the initial overload. A first-use teacher tutorial introduces the workspace instead of leaving users to explore blindly.</p>
          </div>
          <div className="grid gap-7 md:grid-cols-2">
            {roleJourneys.map(({ title, steps }) => (
              <div key={title} className="grid grid-cols-2 gap-3">
                <h3 className="col-span-2 text-sm font-bold tracking-wide text-lime">{title}</h3>
                {steps.map(([label, text]) => (
                  <article key={label} className="rounded-lg bg-[#20271b] p-4">
                    <p className="mb-2 text-xs font-bold text-lime">{label}</p>
                    <p className="text-sm leading-relaxed text-soft">{text}</p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
          <SectionIntro label="04 / THE TEACHER EXPERIENCE" title={<>LESS CLASSROOM ADMIN. MORE ROOM TO TEACH.</>}>
            Teachers were the strongest adoption signal in the research. I focused on making assessment preparation and follow-up feel like one connected task.
          </SectionIntro>
          <div className="grid gap-5 md:grid-cols-[1.3fr_0.7fr] md:items-center">
            <CaseStudyImage
              src={`${ROOT}/ir-teacher-showcase-v2.webp`}
              alt="iRevise teacher desktop classroom dashboard"
              aspectRatio="848 / 657"
              className="hidden md:block bg-[#eeeaff]"
            />
            <CaseStudyImage
              src={`${ROOT}/ir-m-teacher.webp`}
              alt="iRevise teacher mobile dashboard"
              aspectRatio="393 / 852"
              fit="contain"
              className="mx-auto w-full max-w-[302px] bg-[#eeeaff] md:hidden"
            />
            <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-1">
              {[
                ["A / PRIORITISE THE WORK", "Student totals, pending reviews, submission status, and recent activity bring the classroom into one view."],
                ["B / MAKE CREATION FINDABLE", "A clear Create Test entry point gives teachers a route from checking progress to preparing the next assessment."],
                ["C / CLOSE THE LOOP", "Class and student views connect submitted work with marking and feedback, rather than treating grading as a separate destination."],
              ].map(([label, text]) => (
                <article key={label} className="border-t border-line pt-3">
                  <p className="mb-2 text-[10px] font-bold tracking-wide text-moss">{label}</p>
                  <p className="text-sm leading-relaxed text-muted">{text}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold tracking-widest text-moss">02 / SET UP THE ASSESSMENT</p>
              <CaseStudyImage
                src={`${ROOT}/ir-d-setup.webp`}
                alt="iRevise desktop assessment setup"
                aspectRatio="1400 / 996"
                className="hidden md:block bg-[#eeeaff]"
              />
              <CaseStudyImage
                src={`${ROOT}/ir-d-setup.webp`}
                alt="iRevise assessment setup detail"
                aspectRatio="1400 / 996"
                fit="contain"
                className="mx-auto w-full max-w-[310px] bg-[#eeeaff] md:hidden"
              />
              <p className="text-sm leading-relaxed text-muted">Choose a full paper or MCQ, then set academic level, subject, and details. The sequence breaks a complex task into understandable decisions.</p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold tracking-widest text-moss">03 / BUILD QUESTIONS &amp; ANSWERS</p>
              <CaseStudyImage
                src={`${ROOT}/ir-d-build.webp`}
                alt="iRevise desktop question and answer builder"
                aspectRatio="1400 / 996"
                className="hidden md:block bg-[#eeeaff]"
              />
              <CaseStudyImage
                src={`${ROOT}/ir-d-build.webp`}
                alt="iRevise assessment builder detail"
                aspectRatio="1400 / 996"
                fit="contain"
                className="mx-auto w-full max-w-[310px] bg-[#eeeaff] md:hidden"
              />
              <p className="text-sm leading-relaxed text-muted">Add questions, work with an answer set, and preview before assigning. The desktop workspace keeps the question library beside the authoring area.</p>
            </div>
          </div>
          <div className="rounded-xl bg-ink p-5 text-paper">
            <p className="font-display text-xl text-lime sm:text-2xl">CREATE → ASSIGN → SUBMIT → GRADE → REVIEW</p>
            <p className="mt-2 text-sm leading-relaxed text-soft">The design supports both timed MCQs and written-paper uploads. Teachers can add marks and feedback, then publish results back to students.</p>
          </div>
        </div>
      </section>

      <section className="bg-mist px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
          <SectionIntro label="05 / THE STUDENT EXPERIENCE" title={<>FIND THE RIGHT MATERIAL. KNOW WHAT TO DO NEXT.</>}>
            A dashboard brings study entry points and assigned work together. The wider learning journey connects resources, practice, and feedback.
          </SectionIntro>
          <CaseStudyImage
            src={`${ROOT}/ir-student-desktop-v2.webp`}
            alt="iRevise student desktop dashboard with study entry points and assigned work"
            caption="DESKTOP / Study entry points, assigned work, streaks, and trial visibility in one workspace."
            aspectRatio="1296 / 982"
            className="hidden md:block bg-[#eeeaff]"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {learningScreens.map((screen) => (
              <article key={screen.src} className="flex flex-col gap-3 rounded-xl bg-paper p-4">
                <p className="text-[10px] font-bold leading-snug tracking-wide text-moss">{screen.label}</p>
                <CaseStudyImage
                  src={`${ROOT}/${screen.src}`}
                  alt={screen.alt}
                  aspectRatio="393 / 852"
                  className="mx-auto w-full max-w-[302px] md:max-w-[280px] bg-[#eeeaff]"
                />
                <p className="text-sm leading-relaxed text-muted">{screen.text}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[0.7fr_1.3fr] sm:items-start">
            <h3 className="text-xl leading-tight">MAKE PROGRESS VISIBLE.<br />THEN TEST WHAT HELPS.</h3>
            <p className="text-sm leading-relaxed text-muted">The designs explore streaks, XP, rankings, and result feedback. Flashcards, listening practice, and 10-minute sprints appear as entry points, but complete dedicated learning flows are not shown in the supplied screen set.</p>
          </div>
        </div>
      </section>

      <section className="bg-ink px-6 py-14 text-paper sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
          <SectionIntro dark label="06 / A SYSTEM BEHIND THE SCREENS" title={<>FRIENDLY ON THE SURFACE. STRUCTURED UNDERNEATH.</>}>
            The iRevise visual language pairs playful typography and soft purple surfaces with reusable patterns for classroom tasks, resources, and feedback.
          </SectionIntro>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["#826FFB", "PrimaryColor"],
              ["#513DEB", "PurpletoBlue"],
              ["#E3DFFB", "PrimaryLight"],
              ["#F5F3FD", "WhitePrimary"],
            ].map(([color, name]) => (
              <div key={name} className="rounded-lg bg-[#20271b] p-3">
                <div className="mb-3 h-14 rounded" style={{ backgroundColor: color }} />
                <p className="text-sm font-semibold">{name}</p>
                <p className="mt-1 text-xs text-soft">{color}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-lg bg-[#20271b] p-5">
              <p className="mb-3 text-xs font-bold tracking-wide text-lime">DISPLAY &amp; INTERFACE PERSONALITY</p>
              <p className="text-4xl leading-tight">Fredoka</p>
              <p className="mt-3 text-xl leading-snug">Keep learning.<br />Keep growing.</p>
            </article>
            <article className="rounded-lg bg-[#20271b] p-5">
              <p className="mb-3 text-xs font-bold tracking-wide text-lime">READABLE SUPPORTING CONTENT</p>
              <p className="text-3xl leading-tight">Readex Pro</p>
              <p className="mt-3 text-sm leading-relaxed text-soft">Subjects, instructions, and feedback need to remain easy to scan throughout a busy study session.</p>
            </article>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["REUSE THE PATTERN", "A shared family of class cards, assessment cards, resource cards, inputs, buttons, and notifications supports the two workspaces."],
              ["DESIGN THE IN-BETWEEN", "Empty dashboards, pending review, submission results, and subscription states are included—not only ideal, populated screens."],
              ["CHECK BEFORE HANDOFF", "Validate contrast, keyboard and screen-reader behaviour, touch targets, and non-colour status cues during implementation."],
            ].map(([label, text]) => (
              <article key={label}>
                <p className="mb-2 text-[10px] font-bold tracking-wide text-lime">{label}</p>
                <p className="text-sm leading-relaxed text-soft">{text}</p>
              </article>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-soft">
            Palette and typography shown here come from the project’s token documentation. Accessibility recommendations are handoff considerations, not a claim of completed accessibility testing.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
          <SectionIntro label="07 / REFLECTION & NEXT STEPS" title={<>A BETTER LEARNING LOOP. NOT JUST MORE FEATURES.</>} />
          <div className="grid gap-7 md:grid-cols-2">
            <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
              <h3 className="text-xl font-semibold text-ink">What I Learned</h3>
              <p>One of my biggest takeaways from this project was that adding more features does not necessarily make a product better. What matters is understanding what users actually need to accomplish and making those tasks easier.</p>
              <p>For teachers, that meant making it easier to create exams and assign tasks. For students, it meant easily finding assigned work, submitting it, and accessing learning materials. For parents, it meant having a clearer understanding of their children&apos;s learning progress.</p>
              <p>I also learned that educational experiences cannot follow the same structure everywhere. Different countries have different education systems, qualifications, and learning stages. Designing for students in Nepal meant understanding local systems like SEE and SLC rather than assuming that every country follows the same educational structure.</p>
              <p>Another important lesson was the value of communication. At the beginning, I misunderstood the target audience and initially approached the design as if the product were intended for younger children. This led me toward brighter colors and more decorative elements. After clarifying that the platform was designed for teenagers, I had to rethink and adjust the visual direction. It taught me how important it is to clarify requirements and understand the audience before making design decisions.</p>
            </div>
            <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
              <h3 className="text-xl font-semibold text-ink">What I Could Improve</h3>
              <p>I believe I could improve the overall user flows by reducing unnecessary clicks and making important actions easier to reach.</p>
              <p>I also want to work on my understanding of spacing, information hierarchy, and how information is presented across different screens. I want to become better at deciding what deserves attention, what can be simplified, and how to make interfaces feel more organized without overwhelming users.</p>
            </div>
          </div>
          <BackToWorkLink label="BACK TO ALL WORK" />
        </div>
      </section>
    </SiteShell>
  );
}

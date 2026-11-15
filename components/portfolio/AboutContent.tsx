import Image from "next/image";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { SectionLabel, SiteShell, Tag } from "./site";

const PORTRAIT = "/idneittycard2.jpeg";
const DESK = "/portfolio/desk.png";

const principles = [
  {
    n: "01 /",
    t: "PEOPLE BEFORE PIXELS.",
    d: "A beautiful solution to the wrong problem is still the wrong solution. I start with context, conversations, and the people on the other side of the screen.",
  },
  {
    n: "02 /",
    t: "CLARITY IS A KINDNESS.",
    d: "Good design should help people feel capable. I aim for clear language, predictable patterns, and accessible experiences that don’t need explaining.",
    hl: true,
  },
  {
    n: "03 /",
    t: "LEAVE ROOM FOR DELIGHT.",
    d: "Useful doesn’t have to mean forgettable. A thoughtful detail, an unexpected rhythm, or a bit of warmth can make the ordinary feel special.",
  },
];

const inputs = [
  { title: "Architecture", description: "Finding rhythm in real spaces.", icon: "/landmark.svg" },
  { title: "Little details", description: "Noticing the things we overlook.", icon: "/sparkles.svg" },
  { title: "Analog ideas", description: "Thinking better on paper.", icon: "/pencil.svg" },
];

export default function AboutRoute() {
  return (
    <SiteShell activePage="about">
      <section className="gutter flex flex-col gap-8 pt-8 pb-14 md:gap-11 md:pt-16">
        <SectionLabel>ABOUT / A LITTLE MORE HUMAN</SectionLabel>
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-15">
          <div className="flex flex-1 flex-col gap-7">
            <div className="flex flex-col gap-3.5">
              <MagneticTarget id="about-title" priority={3}>
                <h1 className="text-[clamp(44px,7vw,99px)] leading-[0.98] tracking-[-0.04em]">
                  SERIOUS ABOUT
                  <br />
                  GOOD DESIGN.
                </h1>
              </MagneticTarget>
              <p className="font-display text-[clamp(22px,3vw,42px)] leading-none text-moss">
                NOT SO SERIOUS ABOUT MYSELF.
              </p>
            </div>
            <p className="max-w-155 text-lg leading-[1.6] text-muted md:text-xl">
              Hey, I’m Dipak Pahari — a UI/UX designer with a curious mind, bold ideas, and a belief
              that digital things should feel a little more human.
            </p>
            <div className="flex max-w-169.5 flex-wrap gap-3 border-t border-line pt-6">
              <Tag active>Figma</Tag>
              <Tag>FigJam</Tag>
              <Tag>Framer</Tag>
              <Tag>Aseprite</Tag>
              <Tag>Rive</Tag>
            </div>
          </div>
          <div className="relative mx-auto h-100 w-85 shrink-0 text-[14px] tracking-[1px] lg:mx-0 lg:w-92">
            <div className="absolute top-16.5 left-4 h-73.5 w-69 rotate-[7deg] overflow-hidden rounded-[20px]">
              <Image
                src={PORTRAIT}
                alt="Portrait of Dipak"
                fill
                sizes="276px"
                loading="eager"
                className="object-cover object-[66%_center]"
              />
            </div>
            <span className="absolute top-2 left-41 text-[#747c6d]">OVERTHINKER</span>
            <span className="absolute top-6.5 left-1.5 font-bold text-muted">CALM</span>
            <span className="absolute top-88.5 left-1.5 font-bold text-muted">CURIOUS</span>
            <span className="font-display absolute top-9.5 left-72.5 text-[58px] text-lime">✦</span>
          </div>
        </div>
      </section>

      <section className="gutter flex flex-col items-center gap-10 bg-paper-2 py-14 md:flex-row md:gap-20 md:py-22">
        <Image
          src={DESK}
          alt="A desk with sketchbooks by a window"
          width={510}
          height={460}
          sizes="(min-width: 768px) 510px, 100vw"
          className="aspect-510/460 w-full rounded-[20px] object-cover md:w-127.5 md:shrink-0"
        />
        <div className="flex flex-1 flex-col gap-6">
          <h2 className="text-[clamp(34px,4vw,56px)] leading-[1.02]">
            A little overthinking.
            <br />A lot of asking why.
          </h2>
          <p className="text-lg leading-[1.6] text-muted">
            Why do people tap here and not there? What makes them pause, go back, or give up? I
            catch myself asking these questions about the everyday things we use.
          </p>
          <p className="text-lg leading-[1.6] text-muted">
            That curiosity shapes how I approach UI/UX design. I look beyond what someone does to
            understand what they expected, what got in the way, and how the experience could feel
            clearer.
          </p>
          <p className="text-xl leading-[1.45] font-bold">
            Not overthinking every pixel. Thinking a little deeper about the person using it.
          </p>
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 py-14 md:gap-11 md:py-22">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-20">
          <h2 className="text-[clamp(40px,5vw,64px)] leading-[1.02] md:w-170">
            HOW I SEE DESIGN.
          </h2>
          <p className="flex-1 text-lg leading-[1.6] text-muted">
            Tools change. Trends move on. These are the ideas I try to keep coming back to.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {principles.map((p) => (
            <article
              key={p.n}
              className={`flex flex-col gap-6 rounded-[20px] p-7 transition-transform duration-200 hover:-translate-y-1 ${p.hl ? "bg-lime" : "bg-paper-2"}`}
            >
              <span className="font-display text-5xl">{p.n}</span>
              <h3 className="text-[clamp(26px,2.4vw,32px)] leading-[1.1]">{p.t}</h3>
              <p className="text-base leading-[1.6] text-muted">{p.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-paper-2 py-12 md:flex-row md:gap-16">
        <div className="flex flex-col gap-3 md:w-105">
          <h2 className="text-[clamp(32px,3.2vw,40px)] leading-none">INPUT IS EVERYWHERE.</h2>
          <p className="text-[15px] leading-[1.6] text-muted">
            Architecture, everyday objects, a good walk. The best ideas don’t always start in a
            design file.
          </p>
        </div>
        <div className="grid flex-1 gap-6 sm:grid-cols-3">
          {inputs.map((input) => (
            <div key={input.title} className="flex flex-col gap-3.5">
              <Image src={input.icon} alt="" aria-hidden="true" width={40} height={40} />
              <h3 className="text-2xl">{input.title}</h3>
              <p className="text-sm text-muted">{input.description}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

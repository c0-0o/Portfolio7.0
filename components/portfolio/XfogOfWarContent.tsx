import { MagneticTarget } from "@/lib/magnetic-lines";
import { CaseStudyImage } from "./CaseStudyImage";
import { BackToWorkLink, SectionLabel, SiteShell } from "./site";

const assets = "/case-studies/xfog-of-war";

const overview = [
  {
    label: "THE PRODUCT",
    title: "Chess under uncertainty.",
    text: "A browser chess game where fog changes what each player can see.",
  },
  {
    label: "DESIGN COVERAGE",
    title: "From rules to rematch.",
    text: "Interface design, responsive match views, custom pieces, and supporting states.",
  },
  {
    label: "MY CONTRIBUTION",
    title: "The visual system.",
    text: "A board-first interface and a cohesive set of chess-piece artwork and icons.",
  },
];

const principles = [
  {
    number: "01",
    title: "Keep the board legible",
    text: "The board and its pieces are the primary information surface, even when visibility is limited.",
  },
  {
    number: "02",
    title: "Explain the unfamiliar",
    text: "Make the Fog of War rules and special mechanics discoverable instead of asking players to guess.",
  },
  {
    number: "03",
    title: "Protect the rhythm",
    text: "Keep supporting controls close at hand, but let the match remain the center of attention.",
  },
];

const personas = [
  {
    number: "01",
    title: "New to Fog of War",
    need: "Understand what is hidden, what is visible, and how the variant changes a familiar game.",
    response: "Introduce the rules in context and make board feedback easy to read.",
  },
  {
    number: "02",
    title: "Familiar with the game",
    need: "Get into a match quickly and focus on the next move rather than relearning the interface.",
    response: "Keep familiar chess conventions and match controls consistent across screens.",
  },
];

const journey = [
  ["01", "Enter", "Meet the game and understand its premise."],
  ["02", "Choose", "Continue as a guest or use an account."],
  ["03", "Start a match", "Move from the lobby into a game."],
  ["04", "Read the board", "See the pieces and information available to you."],
  ["05", "Make a move", "Use clear selection and movement feedback."],
  ["06", "Stay connected", "Reach chat, friends, notifications, and settings."],
];

const pieceFamilies = [
  {
    name: "Pawn",
    src: "pawn-variants.webp",
    alt: "White and black pawn variants with a 27 pixel base measurement.",
    caption: "Two team variants / 27 px base",
  },
  {
    name: "Rook",
    src: "rook-variants.webp",
    alt: "White and black rook icon variants.",
    caption: "A strong, recognizable tower silhouette",
  },
  {
    name: "Knight",
    src: "knight-variants.webp",
    alt: "White and black knight icon variants.",
    caption: "Distinct profile at board scale",
  },
  {
    name: "Bishop",
    src: "bishop-variants.webp",
    alt: "White and black bishop icon variants.",
    caption: "A simple shape with a clear center",
  },
  {
    name: "Queen",
    src: "queen-variants.webp",
    alt: "White and black queen icon variants.",
    caption: "A broad crown, balanced base",
  },
  {
    name: "King",
    src: "king-variants.webp",
    alt: "White and black king icon variants.",
    caption: "The most important silhouette on the board",
  },
];

const pieceStates = [
  {
    title: "Queen",
    src: "queen-states.webp",
    alt: "Queen piece in resting and selected states.",
    caption: "Resting / selected",
    ratio: "294 / 180",
  },
  {
    title: "King",
    src: "king-states.webp",
    alt: "King piece in resting and selected states.",
    caption: "Resting / selected",
    ratio: "294 / 180",
  },
  {
    title: "Movement feedback",
    src: "movement-preview.webp",
    alt: "Chessboard movement preview with a highlighted move.",
    caption: "Board feedback / show the action, not only the color",
    ratio: "336 / 335",
  },
];

const productStates = [
  {
    title: "Lobby",
    src: "lobby-home.webp",
    alt: "XFog of War lobby home screen.",
    caption: "A clear starting point before a match",
    ratio: "604 / 430",
  },
  {
    title: "Lobby notification",
    src: "lobby-notification.webp",
    alt: "XFog of War lobby with a notification panel open.",
    caption: "Notifications without losing the lobby context",
    ratio: "604 / 430",
  },
  {
    title: "Sign in",
    src: "login-screen.webp",
    alt: "XFog of War sign-in screen.",
    caption: "An account entry point alongside guest play",
    ratio: "604 / 511",
  },
  {
    title: "Friends",
    src: "friends-list.webp",
    alt: "XFog of War friends list screen.",
    caption: "A place to find and invite players",
    ratio: "604 / 430",
  },
  {
    title: "No friends yet",
    src: "friends-empty.webp",
    alt: "XFog of War friends screen in its empty state.",
    caption: "An empty state that still offers a next step",
    ratio: "604 / 430",
  },
  {
    title: "Notifications",
    src: "notification-center.webp",
    alt: "XFog of War notification center.",
    caption: "A dedicated view for incoming activity",
    ratio: "604 / 430",
  },
  {
    title: "Guest settings",
    src: "mobile-guest-settings.webp",
    alt: "XFog of War mobile settings for a guest player.",
    caption: "Mobile / guest settings",
    ratio: "384 / 833",
  },
  {
    title: "Profile settings",
    src: "mobile-profile-settings.webp",
    alt: "XFog of War mobile profile settings.",
    caption: "Mobile / account and profile settings",
    ratio: "384 / 1128",
  },
  {
    title: "Email verification",
    src: "email-verification.webp",
    alt: "XFog of War email verification screen.",
    caption: "Mobile / email verification",
    ratio: "384 / 835",
  },
];

function CaseSectionIntro({
  label,
  title,
  children,
  dark = false,
}: {
  label: string;
  title: string;
  children: string;
  dark?: boolean;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_0.8fr] md:items-end md:gap-14">
      <div className="flex flex-col gap-4">
        <SectionLabel tone={dark ? "lime" : "muted"}>{label}</SectionLabel>
        <h2
          className={`text-[clamp(34px,5vw,62px)] leading-[1.02] ${
            dark ? "text-paper" : "text-ink"
          }`}
        >
          {title}
        </h2>
      </div>
      <p className={`text-base leading-[1.7] ${dark ? "text-soft" : "text-muted"}`}>
        {children}
      </p>
    </div>
  );
}

export default function XfogOfWarContent() {
  return (
    <SiteShell activePage="projects">
      <div className="xfog-case-study">
      <section className="gutter flex flex-col gap-8 pt-6 pb-14 md:gap-12 md:pt-14 md:pb-20">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <BackToWorkLink label="Back to selected work" />
          <SectionLabel>BROWSER GAME / INTERFACE & ICON DESIGN</SectionLabel>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <div>
            <MagneticTarget id="xfog-case-study-title" priority={3}>
              <h1 className="text-[clamp(44px,8.5vw,112px)] leading-[0.96] md:text-[clamp(48px,8.5vw,112px)]">
                XFOG OF WAR.
              </h1>
            </MagneticTarget>
            <p className="mt-5 font-display text-[clamp(24px,3vw,40px)] text-moss">
              CHESS, DESIGNED FOR THE BROWSER.
            </p>
          </div>
          <p className="text-lg leading-[1.7] text-muted">
            XFog of War is a browser-based chess game built around incomplete
            information. I designed the interface and the custom chess-piece
            artwork, bringing the rules, board, and supporting screens into one
            visual system.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {overview.map((item) => (
            <article
              key={item.label}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-mist p-5 md:p-6"
            >
              <span className="text-[10px] font-bold tracking-[1.2px] text-muted uppercase">
                {item.label}
              </span>
              <h2 className="text-2xl leading-tight">{item.title}</h2>
              <p className="text-sm leading-[1.65] text-muted">{item.text}</p>
            </article>
          ))}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.34fr)] lg:gap-6">
          <CaseStudyImage
            src={`${assets}/desktop-match.webp`}
            alt="Desktop XFog of War match interface with the chessboard as the main focus."
            caption="Desktop / board-first match interface"
            captionPosition="bottom"
            aspectRatio="912 / 649"
            className="xfog-match-desktop"
            loading="eager"
          />
          <CaseStudyImage
            src={`${assets}/mobile-match.webp`}
            alt="Mobile XFog of War match interface with the board and game controls."
            caption="Mobile / match view"
            captionPosition="bottom"
            aspectRatio="296 / 642"
            fit="contain"
            className="xfog-match-mobile mx-auto w-full max-w-65 sm:max-w-70 lg:max-w-67.5"
            loading="eager"
          />
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-ink py-14 md:gap-11 md:py-22">
        <CaseSectionIntro
          label="01 / THE DESIGN CHALLENGE"
          title="CHESS WITH LESS CERTAINTY."
          dark
        >
          Fog of War changes the familiar chess board: each player sees only
          information available to their side. The challenge was to make that
          uncertainty understandable without letting the interface become
          another obstacle.
        </CaseSectionIntro>

        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {principles.map((item) => (
            <article
              key={item.number}
              className="flex flex-col gap-4 rounded-2xl border border-ink-line p-5 md:p-7"
            >
              <span className="font-display text-4xl text-lime">{item.number}</span>
              <h3 className="text-[24px] leading-tight text-paper">{item.title}</h3>
              <p className="text-sm leading-[1.7] text-soft">{item.text}</p>
            </article>
          ))}
        </div>

        <CaseStudyImage
          src={`${assets}/play-state-overview.webp`}
          alt="A horizontal overview of three XFog of War gameplay interface states."
          caption="Board-state review / comparing gameplay moments side by side"
          captionPosition="bottom"
          aspectRatio="1264 / 355"
        />
      </section>

      <section className="gutter flex flex-col gap-8 py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="02 / PERSONAS → DESIGN DIRECTION"
          title="DESIGN FOR TWO DIFFERENT MOMENTS."
        >
          These two player mindsets are design lenses, not claims from a
          formally validated research study. They help keep the interface
          useful both when the rules are new and when the player is ready to
          focus on the match.
        </CaseSectionIntro>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {personas.map((persona) => (
            <article
              key={persona.number}
              className="flex flex-col gap-6 rounded-2xl bg-mist p-6 md:p-8"
            >
              <div className="flex items-start justify-between gap-5">
                <span className="font-display text-4xl text-moss">{persona.number}</span>
                <span className="rounded-full border border-line px-3 py-1 text-[10px] font-bold tracking-wide text-muted uppercase">
                  Player mindset
                </span>
              </div>
              <h3 className="text-[28px] leading-tight">{persona.title}</h3>
              <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] font-bold tracking-wide text-muted uppercase">
                    Needs
                  </p>
                  <p className="text-sm leading-[1.7] text-muted">{persona.need}</p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold tracking-wide text-muted uppercase">
                    Design response
                  </p>
                  <p className="text-sm leading-[1.7] text-muted">{persona.response}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-mist py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="03 / INFORMATION ARCHITECTURE"
          title="A SHORT PATH FROM ENTRY TO PLAY."
        >
          The structure separates getting into a game from the tools around
          it. Players can move toward the board quickly, while account and
          social features stay available without competing with the match.
        </CaseSectionIntro>

        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {journey.map(([number, title, text]) => (
            <li
              key={number}
              className="flex min-h-32 flex-col justify-between rounded-2xl border border-line bg-paper p-5 transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:border-[#bcc7b2] hover:bg-white hover:shadow-[0_12px_28px_rgba(38,52,38,0.08)] md:p-6"
            >
              <span className="font-display text-3xl text-moss">{number}</span>
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl leading-tight">{title}</h3>
                <p className="text-sm leading-[1.65] text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="gutter flex flex-col gap-8 py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="04 / MAKING RULES VISIBLE"
          title="LET THE BOARD TEACH."
        >
          A variant is only enjoyable when players can understand what the
          interface is showing them. Rules, move feedback, and special
          mechanics should be explained at the moment they matter.
        </CaseSectionIntro>

        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          <article className="rounded-2xl border border-line p-5 md:p-6">
            <span className="text-xs font-bold tracking-wide text-moss">01 / ORIENT</span>
            <h3 className="mt-4 text-2xl">What can I see?</h3>
            <p className="mt-3 text-sm leading-[1.7] text-muted">
              Make the visibility rule clear before a player has to interpret
              an unfamiliar board state.
            </p>
          </article>
          <article className="rounded-2xl border border-line p-5 md:p-6">
            <span className="text-xs font-bold tracking-wide text-moss">02 / RESPOND</span>
            <h3 className="mt-4 text-2xl">What just happened?</h3>
            <p className="mt-3 text-sm leading-[1.7] text-muted">
              Use selection and movement feedback to show the action, not
              rely on a color change alone.
            </p>
          </article>
          <article className="rounded-2xl border border-line p-5 md:p-6">
            <span className="text-xs font-bold tracking-wide text-moss">03 / CLARIFY</span>
            <h3 className="mt-4 text-2xl">How does Echo Shield work?</h3>
            <p className="mt-3 text-sm leading-[1.7] text-muted">
              Treat the special mechanic as part of the rules system and make
              its effect understandable in context.
            </p>
          </article>
        </div>

        <div className="grid items-center gap-6 rounded-2xl bg-mist p-5 md:grid-cols-[0.8fr_1fr] md:gap-10 md:p-8">
          <div className="flex flex-col gap-3">
            <SectionLabel>BOARD FIRST</SectionLabel>
            <h3 className="text-[28px] leading-tight">
              Keep feedback attached to the move.
            </h3>
            <p className="text-sm leading-[1.7] text-muted">
              Board highlights make the next step easier to read without
              taking attention away from the pieces.
            </p>
          </div>
          <CaseStudyImage
            src={`${assets}/movement-preview.webp`}
            alt="An XFog of War board state with the selected piece and movement feedback."
            aspectRatio="336 / 335"
            fit="contain"
          />
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-ink py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="05 / VISUAL DIRECTION"
          title="A MISTED WORLD. A CLEAR BOARD."
          dark
        >
          Atmospheric artwork establishes the world of XFog, while the
          in-game board stays high contrast and easy to parse. The two
          directions work together without asking the artwork to carry
          gameplay information.
        </CaseSectionIntro>

        <CaseStudyImage
          src={`${assets}/battlefield-artwork.webp`}
          alt="Foggy chess battlefield artwork with white and black kings facing across a board."
          aspectRatio="1264 / 645"
        />

        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {[
            ["Atmosphere", "Use fog and landscape to set a tone outside the match."],
            ["Contrast", "Keep pieces and board states distinct against the grid."],
            ["Consistency", "Carry the same visual language into menus and controls."],
          ].map(([title, text]) => (
            <article key={title} className="rounded-2xl border border-ink-line p-5 md:p-6">
              <h3 className="text-2xl text-paper">{title}</h3>
              <p className="mt-3 text-sm leading-[1.7] text-soft">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-mist py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="06 / CUSTOM CHESS SET"
          title="ONE FAMILY OF DISTINCT SILHOUETTES."
        >
          Each piece was designed to feel at home in the same set. A clear
          outline, consistent treatment, and white and black variants help
          the pieces stay recognizable on the board.
        </CaseSectionIntro>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pieceFamilies.map((piece) => (
            <article
              key={piece.name}
              className="flex flex-col gap-3 rounded-2xl bg-paper p-4 md:p-5"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-2xl">{piece.name}</h3>
                <span className="text-[10px] font-bold tracking-wide text-muted uppercase">
                  Piece study
                </span>
              </div>
              <CaseStudyImage
                src={`${assets}/${piece.src}`}
                alt={piece.alt}
                aspectRatio="294 / 220"
                fit="contain"
              />
              <p className="text-xs leading-relaxed text-muted">{piece.caption}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="07 / THE PAWN, UNDER A RULER"
          title="SMALL ARTWORK. DELIBERATE GEOMETRY."
        >
          The pawn set the scale for the system. Its component cell, head,
          height, and base were considered together so the silhouette would
          remain recognizable at its intended size.
        </CaseSectionIntro>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-2xl bg-mist p-4 md:p-5">
            <h3 className="text-xl">01 / Dimensions</h3>
            <CaseStudyImage
              src={`${assets}/pawn-dimensions.webp`}
              alt="Pawn measurement diagram showing a 51 by 51 pixel cell, 35 pixel height, 27 pixel base, and 13 pixel head."
              aspectRatio="294 / 310"
              fit="contain"
            />
            <p className="text-xs leading-relaxed text-muted">
              51 × 51 px component cell / 35 px high / 27 px base / Ø13 px head
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-mist p-4 md:p-5">
            <h3 className="text-xl">02 / Construction</h3>
            <CaseStudyImage
              src={`${assets}/pawn-construction.webp`}
              alt="Exploded pawn construction showing the head and neck, flared stem, and stepped foot."
              aspectRatio="294 / 310"
              fit="contain"
            />
            <p className="text-xs leading-relaxed text-muted">
              Head and neck / flared stem / stepped foot / 27 × 7 px base frame
            </p>
          </div>
          <aside className="flex h-full flex-col justify-between gap-8 rounded-2xl bg-ink p-6 md:p-7">
            <SectionLabel tone="lime">DESIGN CHECK</SectionLabel>
            <div className="flex flex-col gap-4">
              <h3 className="text-[28px] leading-tight text-paper">
                Readable before decorative.
              </h3>
              <p className="text-sm leading-[1.7] text-soft">
                The pawn is the smallest and most numerous piece. Keeping its
                proportions simple gives it a clear outline without adding
                unnecessary detail.
              </p>
            </div>
            <p className="border-t border-ink-line pt-4 text-xs leading-relaxed text-soft">
              Same component cell / matching base width across both teams
            </p>
          </aside>
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-mist py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="08 / THREE TONES + OUTLINE"
          title="MAKE BOTH TEAMS READ AT A GLANCE."
        >
          The pieces use a restrained tonal range rather than relying on
          complex shading. The values below are sampled from the supplied
          artwork; the outline keeps each form distinct from the board.
        </CaseSectionIntro>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {[
            {
              title: "White pieces",
              swatches: [
                ["Body", "#FFFCF2"],
                ["Shadow", "#E6E8DD"],
                ["Highlight", "#FFFFFF"],
                ["Outline", "#4E4B4A"],
              ],
            },
            {
              title: "Black pieces",
              swatches: [
                ["Body", "#4E4B4A"],
                ["Shadow", "#313131"],
                ["Highlight", "#7D8178"],
                ["Outline", "#1B1B1B"],
              ],
            },
          ].map((team) => (
            <article key={team.title} className="rounded-2xl bg-paper p-5 md:p-7">
              <h3 className="mb-5 text-2xl">{team.title}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {team.swatches.map(([label, color]) => (
                  <div key={label} className="flex flex-col gap-2">
                    <span
                      className="h-14 rounded-lg border border-line"
                      style={{ backgroundColor: color }}
                      aria-label={`${label} color ${color}`}
                    />
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-[10px] text-muted">{color}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {[
            ["Three tones", "Body, shadow, and highlight build volume without overworking the small forms."],
            ["A confident outline", "A consistent edge separates each piece from the board and nearby squares."],
            ["One shared system", "The two teams use the same structure, so color changes do not change recognition."],
          ].map(([title, text]) => (
            <article key={title} className="rounded-2xl border border-line p-5 md:p-6">
              <h3 className="text-xl">{title}</h3>
              <p className="mt-3 text-sm leading-[1.7] text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="09 / STATE DESIGN"
          title="A SMALL CHANGE SHOULD STILL FEEL CLEAR."
        >
          Selected pieces and possible moves need to be noticeable without
          disrupting the style of the set. The state treatment keeps the
          underlying silhouettes consistent.
        </CaseSectionIntro>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {pieceStates.map((state) => (
            <article key={state.title} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-xl">{state.title}</h3>
                <span className="text-[10px] font-bold tracking-wide text-muted uppercase">
                  Interaction state
                </span>
              </div>
              <CaseStudyImage
                src={`${assets}/${state.src}`}
                alt={state.alt}
                caption={state.caption}
                captionPosition="bottom"
                aspectRatio={state.ratio}
                fit="contain"
              />
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-mist py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="10 / DESKTOP ↔ MOBILE"
          title="KEEP THE MATCH INTACT AS THE SCREEN SHRINKS."
        >
          The board remains the anchor at both sizes. On mobile, supporting
          controls reorganize around the smaller viewport rather than
          compressing the desktop layout.
        </CaseSectionIntro>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.34fr)] lg:gap-6">
          <CaseStudyImage
            src={`${assets}/desktop-match.webp`}
            alt="Desktop match layout with the board, game information, and supporting controls."
            caption="Desktop / board and match controls"
            captionPosition="bottom"
            aspectRatio="912 / 649"
            className="xfog-match-desktop"
          />
          <CaseStudyImage
            src={`${assets}/mobile-match.webp`}
            alt="Mobile match layout with a vertically arranged board and controls."
            caption="Mobile / controls arranged for a narrow screen"
            captionPosition="bottom"
            aspectRatio="296 / 642"
            fit="contain"
            className="xfog-match-mobile mx-auto w-full max-w-65 sm:max-w-70 lg:max-w-67.5"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {[
            ["Board geometry", "Preserve the playable board as a clear, stable area."],
            ["Responsive hierarchy", "Keep the most important match information close to play."],
            ["Touch-friendly controls", "Arrange supporting actions for the space and input of a phone."],
          ].map(([title, text]) => (
            <article key={title} className="rounded-2xl bg-paper p-5 md:p-6">
              <h3 className="text-xl">{title}</h3>
              <p className="mt-3 text-sm leading-[1.7] text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="11 / COMPLETE PRODUCT STATES"
          title="A MATCH IS MORE THAN THE BOARD."
        >
          The wider experience includes entry, social, and account moments.
          These screens extend the same visual system around the core game.
        </CaseSectionIntro>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {productStates.map((state) => (
            <article key={state.title} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-xl">{state.title}</h3>
                <span className="text-[10px] font-bold tracking-wide text-muted uppercase">
                  Product state
                </span>
              </div>
              <CaseStudyImage
                src={`${assets}/${state.src}`}
                alt={state.alt}
                caption={state.caption}
                captionPosition="bottom"
                aspectRatio={state.ratio}
                fit="contain"
              />
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-ink py-14 md:gap-11 md:py-20">
        <CaseSectionIntro
          label="12 / DELIVERABLES, TRADE-OFFS & NEXT STEPS"
          title="WHAT I LEARNED. WHAT I WOULD IMPROVE."
          dark
        >
          The work brought interface, responsive layouts, and piece artwork
          together. The next step is to validate the decisions with players
          and refine the experience against real match behavior.
        </CaseSectionIntro>

        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          <article className="flex flex-col gap-5">
            <h3 className="text-[28px] leading-tight text-paper">What I learned</h3>
            <ul className="flex flex-col gap-4">
              {[
                "When a game changes familiar rules, the interface has to communicate those rules as carefully as it presents the board.",
                "Small artwork needs deliberate geometry. The pawn's 51 × 51 px component cell made proportion and silhouette tangible.",
                "Pieces and board states work best as one system; contrast, outline, and selection feedback all affect readability.",
                "Responsive design changes the way a match is arranged, not just the width of its container.",
              ].map((text) => (
                <li key={text} className="text-sm leading-[1.75] text-soft">
                  {text}
                </li>
              ))}
            </ul>
          </article>
          <article className="flex flex-col gap-5">
            <h3 className="text-[28px] leading-tight text-paper">What I could improve</h3>
            <ul className="flex flex-col gap-4">
              {[
                "Test the rules and Echo Shield explanation with new and returning players, then revise anything that is still easy to misread.",
                "Prototype more in-match states at desktop and mobile sizes, including edge cases that only appear during real play.",
                "Validate contrast, touch targets, and supporting flows with implementation in hand before calling the design finished.",
              ].map((text) => (
                <li key={text} className="text-sm leading-[1.75] text-soft">
                  {text}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="flex flex-col gap-5 border-t border-ink-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <BackToWorkLink label="Back to selected work" />
          <p className="text-sm leading-relaxed text-soft">
            Browser chess game / interface design / custom chess-piece artwork
          </p>
        </div>
      </section>
      </div>
    </SiteShell>
  );
}

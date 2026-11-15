import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";

import { SectionLabel, SiteShell, Tag } from "./site";

const HERO_MAIN = "/portfolio/storefront.png";
const HERO_A = "/portfolio/storefront-a.png";
const HERO_B = "/portfolio/storefront-b.png";
const P1 = "/portfolio/product-a.png";
const P2 = "/portfolio/product-b.png";
const DETAIL = P1;
const BAG1 = "/portfolio/bag-a.png";
const BAG2 = "/portfolio/bag-b.png";

const goals = [
  ["01 /", "FIND WITHOUT FRICTION.", "Use recognisable categories, search and relevant filters so a shopper can narrow the catalogue without starting over."],
  ["02 /", "DECIDE WITH CONTEXT.", "Bring price, variants, availability and delivery information into the decision—not after a shopper commits."],
  ["03 /", "BUY WITHOUT DOUBT.", "Keep the order, costs and delivery terms visible so the final step feels like confirmation, not a surprise."],
];

const stages = [
  ["01", "Discover", "“Where do I start?”", "Storefront / Search", "Offer a broad browse route and a direct search route."],
  ["02", "Narrow", "“Which fits my needs?”", "Listing / Filters", "Make filters visible, reversible and easy to read."],
  ["03", "Decide", "“Is this right for me?”", "Product detail", "Put price, options and delivery beside the purchase action."],
  ["04", "Review", "“What am I buying?”", "Bag", "Show items, quantities and totals before payment."],
  ["05", "Complete", "“Is it done?”", "Checkout / Confirmation", "Offer guest checkout and a clear order confirmation."],
];

const decisions = [
  ["Calm structure. Clear priority.", "A neutral shopping canvas keeps products in focus. Repeated card layouts make the catalogue easier to scan, while one prominent purchase action gives each screen a clear hierarchy."],
  ["Useful content before decoration.", "Prioritise product names, prices, options and fulfilment terms over promotional noise. Specifications should reflect the actual merchandise; delivery and return copy must reflect real policies."],
  ["Fewer interruptions, not fewer safeguards.", "Avoid forced registration, automatic add-ons and urgency claims. A review step still matters: shoppers need a chance to check their address, payment choice and final order."],
];

const access = [
  ["Keyboard friendly", "Every control reachable and operable without a pointer."],
  ["Visible focus", "Clear focus rings on links, filters and form fields."],
  ["Labelled forms", "Persistent labels and specific, recoverable error messages."],
  ["Readable contrast", "Text and controls checked against contrast guidance."],
];

const validation = [
  ["Find a product within a budget.", "Can shoppers use search and filters, understand the result set and recover from no matches?", "Revisit category labels or filter priority if people repeatedly reset or backtrack."],
  ["Choose the right product option.", "Do shoppers notice variants, availability and delivery details before adding to bag?", "Move key option and delivery details closer to the purchase action."],
  ["Add to bag and check the total.", "Is the bag state obvious, and are quantity changes and costs easy to understand?", "Simplify bag controls or surface costs earlier."],
  ["Complete a guest order after an error.", "Can shoppers recover from a payment error without losing their details?", "Rework error copy and keep entered details through retries."],
];

const products = [
  ["Everyday tote", "$28", "2 colours available", P1],
  ["Steel bottle", "$24", "3 colours available", P2],
  ["Daily notebook", "$16", "2 colours available", BAG2],
  ["Canvas pouch", "$14", "1 colour available", HERO_A],
];

function StoreBar({ big }: { big?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-line px-4 sm:px-7 ${big ? "h-19" : "h-16"}`}>
      <span className={`font-extrabold tracking-[-0.06em] ${big ? "text-[22px]" : "text-[17px]"}`}>
        em collection.
      </span>
      <div className="hidden gap-6 text-xs sm:flex">
        <span>Shop all</span>
        <span className="text-muted">New arrivals</span>
      </div>
      <span className="text-xs">⌕ &nbsp;Bag (1)</span>
    </div>
  );
}

function Intro({ label, title, desc }: { label: string; title: ReactNode; desc: string }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-20">
      <div className="flex flex-col gap-4 md:w-180">
        <SectionLabel>{label}</SectionLabel>
        <h2 className="text-[clamp(32px,4.4vw,58px)] leading-[1.03]">{title}</h2>
      </div>
      <p className="flex-1 whitespace-pre-line text-base leading-[1.6] text-muted">{desc}</p>
    </div>
  );
}
export default function EmCollectionRoute() {
  return (
    <SiteShell activePage="projects">
      <section className="gutter flex flex-col gap-7 pt-6 pb-12 md:gap-9 md:pt-14 md:pb-18">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <Link href="/#work" className="text-sm text-muted hover:text-ink">
            ← Back to all work
          </Link>
          <SectionLabel>CLIENT WORK / ECOMMERCE</SectionLabel>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-18">
          <div className="flex flex-col gap-3 lg:w-195">
            <MagneticTarget id="em-collection-title" priority={3}>
              <h1 className="text-[clamp(48px,7vw,100px)] leading-[1.04]">EM COLLECTION.</h1>
            </MagneticTarget>
            <p className="font-display text-[clamp(24px,2.7vw,38px)] text-moss">
              LESS GUESSWORK. BETTER SHOPPING.
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-lg leading-[1.6] text-muted">
              An online shopping experience built around one idea: help people find, understand and
              buy with confidence.
            </p>
            <div className="flex flex-wrap gap-2">
              <Tag>Ecommerce UI/UX</Tag>
              <Tag>Full-stack development</Tag>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-y border-line py-5 sm:flex-row sm:gap-10">
          <span className="text-[11px] font-bold tracking-[1px] text-moss">CASE-STUDY DRAFT</span>
          <p className="text-[13px] leading-[1.6] text-muted">
            Project narrative and interface examples are draft material, to be replaced with actual
            project details. The UI below explores a proposed direction, not the delivered product.
          </p>
        </div>

        <div className="flex flex-col gap-5 overflow-hidden rounded-2xl bg-ink p-4 md:p-6">
          <SectionLabel tone="lime">PROPOSED UI / THE STOREFRONT</SectionLabel>
          <p className="text-xs text-soft">Discover → Decide → Checkout</p>
          <div className="overflow-hidden rounded-[10px] bg-paper">
            <StoreBar />
            <div className="flex flex-col gap-6 p-5 sm:p-10 lg:flex-row lg:items-center lg:gap-11">
              <div className="flex flex-col gap-5 lg:w-107.5 lg:shrink-0">
                <span className="text-[11px] font-bold tracking-[1.5px] text-muted">
                  EVERYDAY FINDS, ALL IN ONE PLACE
                </span>
                <h2 className="font-dm text-[clamp(40px,4.3vw,62px)] leading-[1.05] font-semibold tracking-tighter">
                  Good things. Clear choices.
                </h2>
                <p className="leading-[1.6] text-muted">
                  Explore a little of everything. Find the details that make it right for you.
                </p>
                <span className="inline-flex h-13 items-center justify-between self-stretch rounded-full border-[0.65px] border-[#38452e]/60 bg-ink px-7 text-sm font-bold text-[#f5faed] sm:w-65 sm:self-start">
                  Explore the collection <span className="text-[21px] font-normal text-lime">↗</span>
                </span>
                <span className="text-[11px] text-muted">Product details up front. No checkout surprises.</span>
              </div>
              <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-60 w-full flex-1 sm:h-87.5">
                  <Image src={HERO_MAIN} alt="" fill sizes="(min-width: 640px) 60vw, 100vw" className="rounded-[10px] object-cover" />
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:w-57.5 sm:grid-cols-1 sm:gap-4">
                  <div className="relative h-31.5 w-full sm:h-41.75">
                    <Image src={HERO_A} alt="" fill sizes="(min-width: 640px) 230px, 50vw" className="rounded-lg object-cover sm:rounded-[10px]" />
                  </div>
                  <div className="relative h-31.5 w-full sm:h-41.75">
                    <Image src={HERO_B} alt="" fill sizes="(min-width: 640px) 230px, 50vw" className="rounded-lg object-cover sm:rounded-[10px]" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 bg-mist p-4 text-xs sm:h-14.5 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-0 sm:text-[13px]">
              <span>Shop all products ↗</span>
              <span>Explore new arrivals ↗</span>
              <span>Find your everyday favourites ↗</span>
            </div>
          </div>
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-mist py-14 md:gap-11 md:py-22">
        <Intro
          label="01 / THE IDEA"
          title={<>A SHOP FULL OF CHOICES. A CLEAR WAY THROUGH.</>}
          desc={
            "EM Collection is an ecommerce / online shopping project. This draft frames the experience around the path from first browse to completed order, rather than a specific merchandise category.\n\nThe design challenge: a catalogue can make products visible without making choices easy. The proposed response is to reduce uncertainty at each step—what is available, what makes it suitable and what the final purchase involves."
          }
        />
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {goals.map(([n, t, d]) => (
            <article key={n} className="flex flex-col gap-5 rounded-2xl bg-paper p-6 md:rounded-[20px] md:p-7">
              <span className="font-display text-4xl text-moss md:text-[40px]">{n}</span>
              <h3 className="text-[28px] leading-[1.04] md:text-[30px]">{t}</h3>
              <p className="leading-[1.6] text-muted">{d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-ink py-14 md:gap-11 md:py-22">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-20">
          <div className="flex flex-col gap-4 md:w-180">
            <SectionLabel tone="lime">02 / THE JOURNEY</SectionLabel>
            <h2 className="text-[clamp(32px,4.4vw,58px)] leading-[1.03] text-paper">
              ONE NEXT STEP, NOT FIVE OPEN QUESTIONS.
            </h2>
          </div>
          <p className="flex-1 text-base leading-[1.6] text-soft md:text-lg">
            The primary route should stay simple, with room to compare, go back and change your mind.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {stages.map(([n, name, q, tp, d]) => (
            <article key={n} className="flex flex-col gap-3.5 rounded-[10px] border border-ink-line p-5.5">
              <div className="flex items-center justify-between text-xs text-lime">
                <span>{n}</span>
                <span className="text-[22px]">→</span>
              </div>
              <h3 className="text-[30px] text-paper">{name}</h3>
              <p className="text-[15px] leading-[1.4] text-paper">{q}</p>
              <div className="h-px bg-ink-line" />
              <span className="text-xs font-bold text-lime">{tp}</span>
              <p className="text-sm leading-[1.6] text-soft">{d}</p>
            </article>
          ))}
        </div>
        <div className="grid gap-2 border-t border-ink-line pt-5 text-[13px] text-soft sm:grid-cols-2">
          <span><b className="text-lime">Recovery paths:</b> No results → adjust filters</span>
          <span>Unavailable option → choose another · Payment error → retry without losing details</span>
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 py-14 md:gap-11 md:py-22">
        <Intro
          label="03 / BROWSING & DISCOVERY"
          title={<>A GOOD FIND STARTS WITH A CLEAR SEARCH.</>}
          desc={"Proposed UI / Product listing\nA mixed-merchandise example, focused on the mechanics of finding rather than a fixed product range."}
        />
        <div className="rounded-[20px] bg-mist p-3 sm:p-6">
          <div className="overflow-hidden rounded-[10px] border border-line bg-white">
            <StoreBar />
            <div className="flex flex-col gap-6 p-4 sm:p-7">
              <span className="text-[11px] text-muted">Home / Shop all</span>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-dm text-[clamp(26px,2.5vw,32px)] font-semibold tracking-[-0.03em]">
                  Find your next favourite.
                </h3>
                <span className="text-xs text-muted">4 products</span>
              </div>
              <label className="flex h-12 items-center gap-2.5 rounded-md border border-line px-3.5">
                <span className="text-muted" aria-hidden="true">⌕</span>
                <input
                  aria-label="Search products"
                  placeholder="Search products, materials and more"
                  className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-line bg-paper px-3.5 py-2">Category ⌄</span>
                  <span className="rounded-full border border-line bg-paper px-3.5 py-2">Price ⌄</span>
                  <span className="rounded-full border border-line bg-lime px-3.5 py-2">In stock ×</span>
                </div>
                <span>Sort: Featured ⌄</span>
              </div>
              <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                {products.map(([n, p, v, src]) => (
                  <div key={n} className="flex flex-col gap-3">
                    <div className="relative h-53.75 w-full">
                      <Image src={src} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="rounded-[10px] object-cover" />
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <b className="font-semibold">{n}</b>
                      <span>{p}</span>
                    </div>
                    <span className="text-[11px] text-muted">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-mist py-14 md:gap-11 md:py-22">
        <Intro
          label="04 / PRODUCT DETAIL"
          title={<>NOT JUST ‘ADD TO BAG’. A REASON TO FEEL SURE.</>}
          desc={"Proposed UI / Product detail\nAnswer the practical questions beside the purchase action. Let the shopper decide without hunting for the basics."}
        />
        <div className="overflow-hidden rounded-[10px] border border-line bg-white">
          <StoreBar big />
          <div className="flex flex-col gap-6 p-4 sm:p-9">
            <span className="text-xs text-muted">Home / Shop all / Everyday tote</span>
            <div className="flex flex-col gap-8 lg:flex-row lg:gap-14">
              <div className="flex flex-col gap-4 lg:w-142.5 lg:shrink-0">
                <div className="relative h-65 w-full sm:h-102.5">
                  <Image src={DETAIL} alt="Everyday tote, natural" fill sizes="(min-width: 1024px) 570px, 100vw" className="rounded-[10px] object-cover" />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Everyday tote / Natural</span>
                  <span>View larger ↗</span>
                </div>
                <div className="flex flex-col justify-between gap-2 border-t border-line pt-5 text-[13px] text-muted sm:flex-row">
                  <span>Material · Cotton canvas</span>
                  <span>Size · 38 × 42 cm</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-dm text-[clamp(26px,2.6vw,38px)] font-semibold tracking-[-0.03em]">Everyday tote</h3>
                  <span className="text-[26px]">$28.00</span>
                </div>
                <p className="text-[15px] leading-[1.6] text-muted">
                  A simple carryall for everyday essentials. A roomy main compartment and comfortable
                  handles keep the details straightforward.
                </p>
                <span className="text-[13px] font-semibold">Colour: Natural</span>
                <div className="flex gap-2.5 text-[13px]">
                  <span className="flex h-10 items-center rounded-full border-2 border-ink px-4">Natural</span>
                  <span className="flex h-10 items-center rounded-full border border-line px-4">Charcoal</span>
                </div>
                <div className="flex flex-col gap-2 border-y border-line py-4 text-[13px]">
                  <span>In stock · Ready to ship</span>
                  <span className="text-muted">Delivery: 2–4 working days · Free returns within 30 days</span>
                </div>
                <span className="flex h-13 items-center justify-between rounded-full bg-ink px-7 text-sm font-bold text-[#f5faed]">
                  Add to bag · $28.00 <span className="text-[21px] font-normal text-lime">↗</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 py-14 md:gap-11 md:py-22">
        <Intro
          label="05 / BAG TO CHECKOUT"
          title={<>THE LAST STEP SHOULD FEEL LIKE THE EASY ONE.</>}
          desc={"Proposed UI / Bag to checkout\nKeep the order visible, the costs readable and the shopper in control. No forced account before purchase."}
        />
        <div className="flex flex-col gap-7 lg:flex-row">
          <div className="flex flex-col gap-6 rounded-2xl bg-mist p-5 sm:p-7 lg:w-122 lg:shrink-0 lg:rounded-[20px]">
            <span className="text-[11px] font-bold tracking-[1px] text-moss">PROPOSED UI / BAG</span>
            <div className="flex items-baseline justify-between">
              <h3 className="font-dm text-[28px] font-semibold sm:text-[30px]">Your bag</h3>
              <span className="text-[13px] text-muted">2 items</span>
            </div>
            {[
              ["Everyday tote", "$28.00", "Natural", BAG1],
              ["Daily notebook", "$16.00", "Sand", BAG2],
            ].map(([n, p, o, s]) => (
              <div key={n} className="flex gap-4 border-b border-line pb-5">
                <div className="relative h-29 w-23 shrink-0 sm:w-26">
                  <Image src={s} alt="" fill sizes="104px" className="rounded-lg object-cover sm:rounded-[10px]" />
                </div>
                <div className="flex flex-1 flex-col gap-2.5">
                  <div className="flex justify-between text-sm">
                    <b className="font-semibold">{n}</b>
                    <span>{p}</span>
                  </div>
                  <span className="text-xs text-muted">{o}</span>
                  <span className="text-sm">−&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;+</span>
                  <span className="text-[11px] text-muted underline">Remove</span>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>$44.00</span></div>
              <div className="flex justify-between text-muted"><span>Delivery</span><span>$4.00</span></div>
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span>$48.00</span></div>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-5 rounded-[10px] border border-line bg-white p-5 sm:p-7">
            <h3 className="font-dm text-[28px] font-semibold">Checkout as a guest</h3>
            {["Email address", "Full name", "Delivery address", "Card number"].map((l) => (
              <label key={l} className="flex flex-col gap-1.5 text-xs font-semibold">
                {l}
                <input className="h-11 rounded-md border border-line px-3 text-[13px] font-normal outline-none focus:border-ink" />
              </label>
            ))}
            <span className="flex h-13 items-center justify-center rounded-full bg-ink text-sm font-bold text-[#f5faed]">
              Place order · $48.00
            </span>
          </div>
        </div>
        <div className="rounded-2xl bg-ink p-6 text-paper">
          <b className="font-display text-2xl text-lime">ORDER RECEIVED ✓</b>
          <p className="mt-2 text-sm leading-[1.6] text-soft">
            A confirmation email is on its way. Review your order and delivery details from the order summary.
          </p>
          <span className="mt-3 inline-block text-[13px] text-lime underline">View order summary →</span>
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-ink py-14 md:gap-11 md:py-22">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-25">
          <div className="flex flex-col gap-4 md:w-180">
            <SectionLabel tone="lime">06 / WHY THESE CHOICES</SectionLabel>
            <h2 className="text-[clamp(32px,4.4vw,58px)] leading-[1.03] text-paper">
              CHARACTER IN THE DETAILS.
              <br />
              CLARITY IN THE BASICS.
            </h2>
          </div>
          <p className="flex-1 leading-[1.6] text-soft">
            The proposed system puts shopping tasks first. Visual personality should help the
            experience feel coherent, not make essential actions harder to recognise.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {decisions.map(([t, d]) => (
            <article key={t} className="flex flex-col gap-4.5 rounded-2xl border border-ink-line p-6 md:rounded-[20px] md:p-7">
              <h3 className="text-[28px] leading-[1.1] text-paper">{t}</h3>
              <p className="leading-[1.6] text-soft">{d}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-col gap-4 border-t border-ink-line pt-6 md:flex-row md:items-center md:justify-between">
          <h3 className="text-[clamp(26px,2.4vw,34px)] text-paper">ACCESS IS PART OF THE EXPERIENCE.</h3>
          <span className="text-xs text-soft">Implementation checks to carry forward—not an audit result</span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {access.map(([t, d]) => (
            <div key={t} className="flex flex-col gap-2 border-t-2 border-lime pt-4">
              <b className="font-semibold text-paper">{t}</b>
              <p className="text-sm leading-[1.6] text-soft">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 py-14 md:gap-11 md:py-22">
        <div className="flex flex-col gap-6 md:flex-row md:gap-20">
          <div className="flex flex-col gap-4 md:w-160">
            <SectionLabel>07 / REFLECTION</SectionLabel>
            <h2 className="text-[clamp(32px,4.4vw,58px)] leading-[1.03]">
              GOOD DIRECTION. OPEN QUESTIONS.
            </h2>
            <p className="text-lg leading-[1.6] text-muted md:text-xl">
              The central idea is simple: make the next shopping decision easier, without taking
              control away from the shopper.
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-5 text-base leading-[1.6] text-muted md:text-lg">
            <p>
              This proposal connects discovery, product evaluation and checkout into one readable
              flow. Its strongest design move is not removing every step; it is putting the right
              information at the point where a decision happens.
            </p>
            <p>
              The next step would be to use the real catalogue, policies and project constraints,
              then run task-based usability sessions. These are questions to investigate—not
              findings or measured outcomes.
            </p>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="hidden gap-10 border-y border-ink py-4.5 text-[11px] font-bold tracking-[1px] text-moss md:flex">
            <span className="w-85">SHOPPING TASK</span>
            <span className="w-117.5">WHAT I’D LOOK FOR</span>
            <span className="flex-1">WHAT IT COULD CHANGE</span>
          </div>
          {validation.map(([t, o, c], i) => (
            <div key={t} className="flex flex-col gap-4 border-b border-line py-7 first:border-t md:flex-row md:gap-10 md:py-6.5 md:first:border-t-0">
              <div className="flex gap-4.5 md:w-85">
                <span className="text-[13px] text-moss">{String(i + 1).padStart(2, "0")}</span>
                <b className="text-xl leading-[1.4] font-semibold md:text-[19px]">{t}</b>
              </div>
              <p className="leading-[1.6] text-muted md:w-117.5">{o}</p>
              <p className="flex-1 leading-[1.6] text-muted">{c}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 bg-mist p-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span><b className="font-bold text-ink">BEFORE THIS GOES LIVE.</b> Replace draft copy, imagery and policies with real project details.</span>
          <span className="font-display text-xl text-ink">THANKS FOR LOOKING CLOSER.</span>
        </div>
      </section>
    </SiteShell>
  );
}

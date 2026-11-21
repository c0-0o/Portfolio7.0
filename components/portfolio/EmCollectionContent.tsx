import type { ReactNode } from "react";
import { BackToWorkLink, SectionLabel, SiteShell } from "./site";
import { CaseStudyImage } from "./CaseStudyImage";

const ROOT = "/case-studies/em-collection";

function SectionIntro({
  label,
  title,
  children,
  dark = false,
}: {
  label: string;
  title: ReactNode;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_0.8fr] md:items-end md:gap-14">
      <div className="flex flex-col gap-4">
        <SectionLabel tone={dark ? "lime" : "muted"}>{label}</SectionLabel>
        <h2 className={`text-[clamp(32px,4.4vw,58px)] leading-[1.03] ${dark ? "text-paper" : ""}`}>{title}</h2>
      </div>
      <div className={`text-base leading-[1.7] md:text-lg ${dark ? "text-soft" : "text-muted"}`}>{children}</div>
    </div>
  );
}

const flow = [
  ["01", "Discover", "Home, brands and search"],
  ["02", "Refine", "Listing, filters and sort"],
  ["03", "Decide", "Product, colour and size"],
  ["04", "Purchase", "Cart, delivery and payment"],
  ["05", "Follow up", "Confirmation and tracking"],
];

const responsivePrinciples = [
  ["BROWSE", "Preserve the paths.", "Compact navigation, search and a two-column product grid keep the catalogue reachable without shrinking the desktop layout."],
  ["DECIDE", "Stack the essentials.", "Product photography leads into colour, size and purchase controls. Supporting information follows in a single reading order."],
  ["MANAGE", "Prioritise the task.", "Admin layouts stack overview cards, charts and operational information so key tasks remain available on smaller screens."],
];

export default function EmCollectionContent() {
  return (
    <SiteShell activePage="projects">
      <section className="px-6 pt-8 pb-14 sm:px-10 md:pt-14 md:pb-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <BackToWorkLink label="Back to all work" />
            <SectionLabel>ECOMMERCE / NEPAL / RESPONSIVE WEB</SectionLabel>
          </div>
          <div className="grid gap-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="flex flex-col gap-3">
              <h1 className="text-[clamp(48px,8vw,108px)] leading-none">EM COLLECTION.</h1>
              <p className="font-display text-[clamp(25px,3vw,42px)] leading-tight text-moss">
                THE RIGHT PAIR. A CLEARER PATH.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-lg leading-relaxed text-ink">
                Designing a premium multi-brand shoe store for Nepal—from discovering a pair to managing the business behind it.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["PRODUCT", "Footwear, not everything.", "A curated initial catalogue of 30–45 premium products."],
              ["EXPERIENCE", "Two sides. One system.", "Responsive storefront and a complete admin management experience."],
              ["DESIGN SCOPE", "Research to interface.", "Research direction, competitor review, personas, wireframes and final UI."],
            ].map(([label, title, body]) => (
              <article key={label} className="rounded-xl border border-line bg-mist p-5">
                <p className="mb-2 text-xs font-bold tracking-widest text-moss">{label}</p>
                <h2 className="mb-2 text-xl font-semibold">{title}</h2>
                <p className="text-sm leading-relaxed text-muted">{body}</p>
              </article>
            ))}
          </div>
          <CaseStudyImage
            src={`${ROOT}/em-home-composite-v2.webp`}
            alt="EM Collection desktop storefront and mobile home screens"
            aspectRatio="1296 / 765"
            loading="eager"
            className="hidden md:block"
          />
          <CaseStudyImage
            src={`${ROOT}/em-m-home.webp`}
            alt="EM Collection mobile home page"
            aspectRatio="310 / 816"
            objectPosition="top"
            caption="Mobile / Home"
            loading="eager"
            className="mx-auto w-full max-w-77.5 md:hidden"
          />
        </div>
      </section>

      <section className="bg-mist px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro label="01 / THE BRIEF" title={<>MAKE PREMIUM FEEL TRUSTWORTHY.</>}>
            A polished storefront is only half the job. Shoppers need confidence in the product, while the owner needs control over the catalogue and orders.
          </SectionIntro>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["SHOPPER CHALLENGE", "Find it. Understand it. Buy it.", "Help people discover suitable shoes, check size and colour options, and understand the purchase before paying."],
              ["BUSINESS CHALLENGE", "A store the owner can run.", "Support product, inventory, order and homepage management without relying on technical assistance for everyday tasks."],
            ].map(([label, title, text]) => (
              <article key={label} className="rounded-xl border border-line bg-paper p-6 md:p-8">
                <p className="mb-3 text-xs font-bold tracking-widest text-moss">{label}</p>
                <h3 className="mb-3 text-2xl">{title}</h3>
                <p className="leading-relaxed text-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro label="02 / RESEARCH & DIRECTION" title={<>TWO WAYS TO SHOP. ONE EXPERIENCE.</>}>
            The research material defines two shopping modes: a focused search for a known model, and open-ended discovery around comfort, style and value.
          </SectionIntro>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl bg-mist p-5 md:p-7">
              <p className="mb-3 text-xs font-bold tracking-widest text-moss">PRIMARY PERSONA / SNEAKER ENTHUSIAST</p>
              <h3 className="mb-3 text-2xl">“I know the pair I want.”</h3>
              <p className="leading-relaxed text-muted">Raj Kumar, 26, software engineer. Wants a specific Nike Air Force 1 in size 42. His priorities are authenticity, availability and a quick purchase—not a long discovery journey.</p>
            </article>
            <article className="rounded-xl bg-mist p-5 md:p-7">
              <p className="mb-3 text-xs font-bold tracking-widest text-moss">SECONDARY PERSONA / CASUAL SHOPPER</p>
              <h3 className="mb-3 text-2xl">“Help me find the right pair.”</h3>
              <p className="leading-relaxed text-muted">Priya Sharma, 24, marketing professional. Browses for comfortable white shoes for work and casual wear. Needs comparison, clear product information and value.</p>
            </article>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold tracking-widest text-moss">AUDIENCE &amp; RESEARCH BOUNDARY</p>
            <p className="text-sm leading-relaxed text-muted">Primary audience: 18–34. Secondary audience: 35+ with a focus on comfort and quality. These personas guide the design; the supplied material does not establish interview findings or usability-test results.</p>
          </div>
          <div>
            <p className="mb-4 text-xs font-bold tracking-widest text-moss">WHAT THE COMPETITOR REVIEW CHANGED</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["NIKE", "Premium, but local.", "Strong imagery and hierarchy. Retain the premium presentation, but adapt the experience to Nepal."],
                ["ADIDAS", "Filter without overload.", "Comprehensive filtering is useful; complicated navigation makes choices harder to understand."],
                ["LOCAL STORES", "Local fit matters.", "Local payments and delivery knowledge are strengths. Product information and UX are the opportunity."],
                ["PUMA", "Minimal, not empty.", "Keep the mobile clarity while giving shoppers enough product detail to decide."],
              ].map(([brand, title, text]) => (
                <article key={brand} className="rounded-xl border border-line p-5">
                  <p className="mb-2 text-xs font-bold tracking-widest text-moss">{brand}</p>
                  <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink px-6 py-14 text-paper sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro dark label="03 / STRUCTURE BEFORE SURFACE" title={<>THE JOURNEY COMES BEFORE THE POLISH.</>}>
            The wireframes map the purchase path and supporting states before introducing product photography and the final visual treatment.
          </SectionIntro>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {flow.map(([number, title, text]) => (
              <article key={number} className="rounded-lg border border-ink-line bg-[#20271b] p-5">
                <p className="text-xs text-lime">{number}</p>
                <h3 className="my-4 text-2xl">{title}</h3>
                <p className="text-sm leading-relaxed text-soft">{text}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <CaseStudyImage src={`${ROOT}/em-wire-home.webp`} alt="EM Collection storefront home wireframe" aspectRatio="416 / 361" objectPosition="top" caption="Wireframe / Home" />
            <CaseStudyImage src={`${ROOT}/em-wire-listing.webp`} alt="EM Collection product listing wireframe" aspectRatio="416 / 361" objectPosition="top" caption="Wireframe / Product listing" />
            <CaseStudyImage src={`${ROOT}/em-wire-detail.webp`} alt="EM Collection product detail wireframe" aspectRatio="416 / 361" objectPosition="top" caption="Wireframe / Product detail" />
          </div>
          <p className="text-sm leading-relaxed text-soft">A parallel admin journey covers catalogue setup → colour and size variants → publishing → order handling → store content and payment settings.</p>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro label="04 / DISCOVERY" title={<>DISCOVERY WITHOUT THE DEAD ENDS.</>}>
            Brand-led navigation supports the shopper who knows what they want. Lifestyle collections, trending products and a filterable catalogue make room for people still exploring.
          </SectionIntro>
          <CaseStudyImage
            src={`${ROOT}/em-discovery-composite-v2.webp`}
            alt="Desktop product listing and persistent filters"
            aspectRatio="1296 / 911"
            className="hidden md:block"
          />
          <div className="grid gap-4 sm:grid-cols-2 md:hidden">
            <CaseStudyImage
              src={`${ROOT}/em-m-listing.webp`}
              alt="Mobile product listing with selected filters"
              aspectRatio="342 / 940"
              objectPosition="top"
              caption="Mobile / Listing and selected filters"
              className="mx-auto w-full max-w-85.5"
            />
            <CaseStudyImage
              src={`${ROOT}/em-m-filter.webp`}
              alt="Mobile dedicated filter sheet"
              aspectRatio="401 / 678"
              caption="Mobile / Dedicated filter sheet"
              className="mx-auto w-full max-w-85.5"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["01 / TWO ENTRY POINTS", "Search or explore.", "Search suggestions and related products support model-led intent. Brands and everyday-use collections provide a browsing route."],
              ["02 / KEEP CONTEXT", "Show the refinement.", "Colour, size and price selections remain visible as removable chips. A reset action provides a route out of an over-filtered list."],
              ["03 / ADAPT THE CONTROLS", "Sidebar to sheet.", "Desktop filters sit beside results. Mobile moves them into a focused sheet with Reset and Apply Filters."],
            ].map(([label, title, text]) => (
              <article key={label} className="rounded-xl bg-mist p-5">
                <p className="mb-2 text-xs font-bold tracking-widest text-moss">{label}</p>
                <h3 className="mb-2 text-xl">{title}</h3>
                <p className="text-sm leading-relaxed text-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mist px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro label="05 / PRODUCT CONFIDENCE" title={<>CONFIDENCE IS IN THE DETAILS.</>}>
            Footwear decisions depend on more than a product image. The product page brings price, colours, size choice, delivery information and returns into the decision.
          </SectionIntro>
          <CaseStudyImage
            src={`${ROOT}/em-product-desktop-v2.webp`}
            alt="Desktop product details and purchase controls"
            aspectRatio="1296 / 810"
            caption="Desktop / Product details and purchase controls"
            className="hidden md:block"
          />
          <CaseStudyImage
            src={`${ROOT}/em-m-product.webp`}
            alt="Mobile product and purchase controls"
            aspectRatio="342 / 1088"
            objectPosition="top"
            caption="Mobile / Product and purchase controls"
            className="mx-auto w-full max-w-85.5 md:hidden"
          />
          <div className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-start">
            <CaseStudyImage
              src={`${ROOT}/em-size-guide-v2.webp`}
              alt="EM Collection size guide"
              aspectRatio="632 / 539"
              caption="Supporting flow / Size guide"
            />
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl">MAKE FIT LESS OF A GUESS.</h3>
              <p className="text-sm leading-relaxed text-muted">01&nbsp; A size guide connects EU, UK and US sizing with foot measurements. A separate measuring flow explains how to find the right size.</p>
              <p className="text-sm leading-relaxed text-muted">02&nbsp; Colour swatches and size choices sit close to the primary purchase action. Delivery and return information stays nearby.</p>
              <p className="text-sm leading-relaxed text-muted">03&nbsp; Quantity changes belong in the cart, keeping the product page focused on choosing the pair. Further details and reviews sit lower in the hierarchy.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro label="06 / CART & CHECKOUT" title={<>CHECKOUT THAT FITS THE LOCAL CONTEXT.</>}>
            The purchase experience is designed around a smooth, hassle-free checkout. Customers can shop as guests, choose home delivery or store pickup, and pay using familiar Nepal payment options without being forced to create an account. Registration is offered as an optional step during checkout, with a gentle invitation after order completion highlighting the benefits of having an account. This keeps the focus on completing purchases while giving customers the freedom to register when they&apos;re ready.
          </SectionIntro>
          <div className="grid gap-5 md:grid-cols-2">
            <CaseStudyImage
              src={`${ROOT}/em-cart-desktop-v2.webp`}
              alt="Desktop editable cart and cost summary"
              aspectRatio="636 / 539"
              caption="Desktop / Editable cart and cost summary"
              className="hidden md:block"
            />
            <CaseStudyImage
              src={`${ROOT}/em-checkout-desktop-v2.webp`}
              alt="Desktop guest checkout and payment"
              aspectRatio="636 / 539"
              caption="Desktop / Guest checkout and payment"
              className="hidden md:block"
            />
            <CaseStudyImage
              src={`${ROOT}/em-m-cart.webp`}
              alt="Mobile editable cart and summary"
              aspectRatio="342 / 1081"
              objectPosition="top"
              caption="Mobile / Editable cart and summary"
              className="mx-auto w-full max-w-85.5 md:hidden"
            />
            <CaseStudyImage
              src={`${ROOT}/em-m-checkout.webp`}
              alt="Mobile guest checkout, delivery and payment"
              aspectRatio="342 / 1392"
              objectPosition="top"
              caption="Mobile / Guest checkout, delivery and payment"
              className="mx-auto w-full max-w-85.5 md:hidden"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["LESS COMMITMENT", "Guest first.", "Contact details enable the order. Creating an account is an option for saved information and future orders, not the first hurdle."],
              ["LOCAL EXPECTATIONS", "eSewa. Khalti. Store pickup.", "The checkout presents local payment choices and delivery options. Store settings let the owner manage available payment methods."],
              ["A PREDICTABLE FINISH", "Review before paying.", "The summary keeps selected products, shipping and total visible. Confirmation provides an order reference and a route to follow up."],
            ].map(([label, title, text]) => (
              <article key={label} className="border-t-2 border-lime pt-4">
                <p className="text-xs font-bold tracking-widest text-moss">{label}</p>
                <h3 className="my-2 text-xl">{title}</h3>
                <p className="text-sm leading-relaxed text-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mist px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro label="07 / AFTER THE PURCHASE" title={<>THE EXPERIENCE DOESN’T END AT PAYMENT.</>}>
            Order history, tracking, saved addresses and wishlists support the next visit. Empty states explain what happened and give people a useful next action.
          </SectionIntro>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["em-orders-v2.webp", "Account / Orders and delivery status", "Desktop order history and delivery status", "636 / 453"],
              ["em-find-order-v2.webp", "Guest / Find an order", "Guest order lookup", "636 / 230"],
              ["em-no-results-v2.webp", "Recovery / No matching products", "No matching products recovery state", "636 / 257"],
            ].map(([src, caption, alt, aspectRatio]) => (
              <CaseStudyImage
                key={src}
                src={`${ROOT}/${src}`}
                alt={alt}
                aspectRatio={aspectRatio}
                caption={caption}
                className="hidden md:block"
              />
            ))}
            {[
              ["em-m-orders.webp", "Mobile / Orders and delivery status", "Mobile orders and delivery status", "342 / 741"],
              ["em-m-find-order.webp", "Mobile / Find an order", "Mobile guest order lookup", "342 / 557"],
              ["em-m-no-results.webp", "Mobile / No matching products", "Mobile no matching products recovery state", "342 / 627"],
            ].map(([src, caption, alt, aspectRatio]) => (
              <CaseStudyImage
                key={src}
                src={`${ROOT}/${src}`}
                alt={alt}
                aspectRatio={aspectRatio}
                objectPosition="top"
                caption={caption}
                className="mx-auto w-full max-w-85.5 md:hidden"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink px-6 py-14 text-paper sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro dark label="08 / THE BUSINESS SIDE" title={<>DESIGN FOR THE PERSON RUNNING THE STORE.</>}>
            The owner-facing experience is part of the product, not an afterthought. It connects stock, products, orders, promotions and storefront content.
          </SectionIntro>
          <div className="hidden gap-5 md:grid md:grid-cols-[1fr_0.27fr]">
            <CaseStudyImage
              src={`${ROOT}/em-admin-sales-v2.webp`}
              alt="Desktop sales, orders and low-stock overview"
              aspectRatio="1109 / 982"
              objectPosition="top"
            />
            <CaseStudyImage
              src={`${ROOT}/em-m-admin.webp`}
              alt="Mobile-prioritised admin dashboard preview"
              aspectRatio="382 / 1760"
              caption="Mobile / Prioritised dashboard"
            />
          </div>
          <CaseStudyImage
            src={`${ROOT}/em-m-admin.webp`}
            alt="Mobile sales, orders and stock overview"
            aspectRatio="342 / 1088"
            objectPosition="top"
            caption="Mobile / Sales, orders and stock overview"
            className="mx-auto w-full max-w-85.5 md:hidden"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["CATALOGUE", "Variants made visible.", "Product setup groups basic information, pricing, imagery, colours, sizes and generated variants, with a product preview before publishing."],
              ["OPERATIONS", "Orders, not spreadsheets.", "Dedicated order views support status changes and order details. Low-stock alerts make inventory follow-up visible."],
              ["CONTENT & CONTROL", "Keep the storefront current.", "Manage hero banners with desktop and mobile imagery, coupons, product filters, store details and payment availability."],
            ].map(([label, title, text]) => (
              <article key={label} className="rounded-xl border border-ink-line bg-[#20271b] p-5">
                <p className="mb-2 text-xs font-bold tracking-widest text-lime">{label}</p>
                <h3 className="mb-2 text-xl">{title}</h3>
                <p className="text-sm leading-relaxed text-soft">{text}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <CaseStudyImage
              src={`${ROOT}/em-admin-product-v2.webp`}
              alt="Desktop admin product setup, preview and variant workflow"
              aspectRatio="840 / 1664"
              caption="Admin / Product setup, preview and variant workflow"
              className="hidden md:block"
            />
            <CaseStudyImage
              src={`${ROOT}/em-m-admin-product.webp`}
              alt="Mobile admin product setup and variant workflow"
              aspectRatio="1109 / 2140"
              caption="Mobile / Product setup and variants"
              className="mx-auto w-full max-w-85.5 md:hidden"
            />
            <div className="flex flex-col justify-center gap-3 rounded-xl bg-[#20271b] p-6">
              <h3 className="text-2xl">ONE PRODUCT. MANY VARIANTS.</h3>
              <p className="text-sm leading-relaxed text-soft">The colour-and-size model needs to work on both sides: clear choices for shoppers, and manageable inventory for the store owner.</p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-soft">The dashboard’s sales and revenue values are sample UI data. They do not represent a business outcome of this design.</p>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro label="09 / RESPONSIVE BY DESIGN" title={<>RESPONSIVE MEANS REPRIORITISED.</>}>
            The same tasks are preserved across desktop and mobile, but their layout and controls change with the available space.
          </SectionIntro>
          <CaseStudyImage
            src={`${ROOT}/em-responsive-v2.webp`}
            alt="Responsive home, listing, product and checkout screens"
            aspectRatio="1296 / 1143"
            className="hidden md:block"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {responsivePrinciples.map(([label, title, text]) => (
              <article key={label} className="rounded-xl bg-mist p-5">
                <p className="mb-2 text-xs font-bold tracking-widest text-moss">{label}</p>
                <h3 className="mb-2 text-xl">{title}</h3>
                <p className="text-sm leading-relaxed text-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mist px-6 py-14 sm:px-10 md:py-20">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-8">
          <SectionIntro label="10 / DELIVERABLES & REFLECTION" title={<>A COMPLETE DESIGN DIRECTION. AN HONEST NEXT STEP.</>}>
            The deliverable is a responsive footwear commerce experience covering the shopper journey and the management workflows behind it.
          </SectionIntro>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold">What I Learned</h3>
              <p className="text-sm leading-relaxed text-muted">I learned how much small design decisions can affect the overall user experience. Even the smallest detail can help users move forward, create confusion, or completely interrupt their flow.</p>
              <p className="text-sm leading-relaxed text-muted">The most important lesson was understanding what the experience should prioritize. Here, the focus was on helping customers find the right footwear and complete their purchases, not pushing them into creating an account.</p>
              <p className="text-sm leading-relaxed text-muted">Small features can make a meaningful difference. For example, adding a size guide and helping customers understand how to measure their feet makes choosing the right size easier and builds confidence before purchasing.</p>
              <p className="text-sm leading-relaxed text-muted">I learned that good UX is not always about adding more features. Sometimes, it&apos;s about removing unnecessary steps and making the important ones easier.</p>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold">What I Could Improve</h3>
              <p className="text-sm leading-relaxed text-muted">I still have room to grow in my visual design skills, especially when it comes to developing a stronger visual direction for complex interfaces like the admin dashboard.</p>
              <p className="text-sm leading-relaxed text-muted">I want to improve how I approach layout, hierarchy, visual consistency, and information presentation in management interfaces. My next step is to study more real-world admin products, explore different visual approaches, and become more confident in designing these experiences.</p>
            </div>
          </div>
          <BackToWorkLink label="Back to all work" />
        </div>
      </section>
    </SiteShell>
  );
}

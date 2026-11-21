# Portfolio 7.0 SEO Audit

Date: 2026-11-21

## Executive summary

The local Next.js project has strong visual and technical foundations, but it needs an indexed, deployed build and Google Search Console setup to gain organic visibility. The public domain currently appears to be serving an older portfolio experience: the live robots/sitemap and `/work`, `/irevise`, `/codynn`, and `/savvy` content are not yet aligned with this Portfolio 7.0 route structure.

The primary search opportunity is personal-brand demand. For generic UI/UX and product-designer terms, a strong personal portfolio should win gradually through unique case-study depth, real project detail, backlinks, and consistent brand/profile signals rather than keyword density.

## Implementation status

### Implemented

- Added canonical metadata for the homepage, About, Work, Contact, Playground, and all public case studies.
- Added route-specific page titles and descriptions.
- Added Person and WebSite JSON-LD.
- Added WebPage JSON-LD for primary pages.
- Added BreadcrumbList JSON-LD for Work and case-study routes.
- Added CreativeWork JSON-LD for project pages and artwork detail pages.
- Added an XML sitemap containing public portfolio routes.
- Expanded robots directives to block private/editor and QA routes.
- Added migration redirects for old `/irevise`, `/codynn`, `/savvy`, `/xfogofwar`, and `/emcollection` URLs.
- Added canonical redirect handling for `www.dipakpahari.com.np`.
- Added `/work` and `/contact` routes to preserve and improve crawlable navigation.
- Changed the footer Contact link from mail-only navigation to a real `/contact` route.
- Added descriptive alt text to homepage project previews.
- Preserved existing visual, animation, audio, and navigation behavior.
- Added private-route noindex directives for editor, labs, opening preview, and under-construction pages.

### Validation

- Production build: passed.
- ESLint: passed.
- Test suite: 148 tests passed.
- Public route smoke checks: homepage, About, Work, Contact, Playground, Red Light, and case studies return HTTP 200 locally.
- Sitemap, robots, manifest, favicons, OG image, audio, and Aseprite assets respond successfully.
- Browser 404 capture: no failed HTTP responses in the final Playground reload.
- Homepage browser 404 recheck: no failed HTTP responses after restoring moved thumbnail paths.

## Live-domain audit findings

Severity is based on current observable state.

| Severity | Finding | Risk | Action |
|---|---|---|---|
| Critical | Public domain appears to serve an older portfolio version | Google may index old titles, URLs and content while Portfolio 7.0 is unpublished | Deploy Portfolio 7.0 to the canonical apex domain and verify the live sitemap |
| Critical | Old sitemap/listed routes do not match the new route inventory | Old URLs may be stranded or redirected inconsistently | Submit the new sitemap and preserve old URL mappings |
| High | Personal/brand phrases need stronger entity consistency | Search engines may not connect profiles and portfolio content reliably | Use consistent name, title, image, descriptions and profile links |
| High | No GA4 measurement ID or verification ID is present locally | Organic traffic and indexing cannot be measured | Add GA4 and Search Console verification through environment/configuration |
| High | Search Console and indexing status could not be verified locally | Current indexed URLs and migration impact remain unknown | Run `site:dipakpahari.com.np` and URL Inspection in Search Console |
| Medium | Generic service terms are broad and competitive | Ranking for “UI UX designer Nepal” alone is difficult | Prioritize case-study, process, Nepal, and name-plus-service pages |
| Medium | Case studies should become stronger written content | Visual-only pages reduce topical relevance | Expand genuine research, decisions, outcomes and process context |
| Medium | Domain authority and backlink profile are unknown | Strong design pages need credible external links | Build genuine profile and case-study mentions |
| Low | Private/QA routes should remain out of the index | Internal tools could appear in search | Robots and metadata noindex rules are now present |

## Keyword research

No reliable public Google Ads search-volume or keyword-difficulty data was available in this environment. No volume or difficulty numbers are invented below.

| Keyword | Intent | Geographic relevance | Priority | Reason |
|---|---|---|---|---|
| Dipak Pahari | Navigational / brand | Global and Nepal | Highest | Highest-realistic brand opportunity |
| Dipak Pahari portfolio | Navigational / portfolio | Global | Highest | Direct portfolio discovery |
| Dipak Pahari UI UX Designer | Navigational / employment | Nepal and global | Highest | Exact professional identity |
| Dipak Pahari UI/UX Designer Nepal | Navigational / local | Nepal | High | Combines brand and location |
| UI UX Designer Nepal | Commercial / hiring | Nepal | High | Relevant local hiring intent, competitive |
| UI Designer Nepal | Commercial / hiring | Nepal | High | Clearer UI-only variant |
| UX Designer Nepal | Commercial / hiring | Nepal | High | Stronger research/experience variant |
| Product Designer Nepal | Commercial / hiring | Nepal | High | Matches current professional identity |
| UX/UI Designer Portfolio | Informational / portfolio | International | Medium | Portfolio-list intent; strong about/work copy |
| Product Designer Portfolio | Informational / portfolio | International | Medium | Relevant but highly competitive |
| Freelance UI UX Designer Nepal | Commercial / freelance | Nepal | Medium | Long-tail local opportunity |
| SaaS Product Design Case Study | Informational / commercial | International | Medium | Use one detailed project and process |
| Ecommerce UX/UI Case Study | Informational / commercial | International | Medium | EM Collection can target this topic |
| EdTech Product Design Case Study | Informational / commercial | International | Medium | iRevise can target this topic |
| Figma UI UX Designer Nepal | Commercial / tool-specific | Nepal | Medium | Add genuine Figma workflow only where relevant |
| Website Redesign Case Study | Informational / commercial | International | Medium | Codynn is a stronger subject |

Additional useful opportunities:

- UI/UX designer in Kathmandu
- UI/UX designer in Nepal
- Product designer in Kathmandu
- Ecommerce UX case study
- EdTech UX case study
- Chess game interface design
- Browser game UX
- Custom chess piece icon design
- UX process for SaaS dashboards
- Mobile and desktop design system

## Public SERP observations

The Bing checks did not return reliable Nepal-specific “UI UX designer Nepal” or “product designer Nepal” portfolio results. Broad UI searches were dominated by component libraries, educational references, UIHut, Dribbble and developer resources. This indicates that broad generic terms are currently difficult and that personal-brand plus long-tail case-study targeting is more realistic for an early-stage portfolio.

Google exact personal-brand results could not be reliably collected through the public, JavaScript-heavy SERP response in this environment. Google Search Console is the authoritative source for actual impressions, queries and indexed URLs.

Sources:

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google Search Central sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Awwwards portfolio category](https://www.awwwards.com/websites/portfolio/)
- [Dribbble portfolio/search ecosystem](https://dribbble.com/search/ui-designer-portfolio)
- Live portfolio observations: [Dipak Pahari homepage](https://www.dipakpahari.com.np/)
- Live sitemap observation: [dipakpahari.com.np/sitemap.xml](https://www.dipakpahari.com.np/sitemap.xml)

## Competitor analysis

### High-authority design ecosystems

- **Dribbble**
  - Strength: strong visual discovery and high-profile backlinks.
  - Weakness: limited in-depth UX process and no complete portfolio control.
  - Opportunity: publish polished previews, but always link to detailed project pages.
- **Behance**
  - Strength: established project and portfolio ecosystem.
  - Weakness: weaker control over metadata and long-form technical depth.
  - Opportunity: synchronize summaries and project links with the owned domain.
- **Awwwards portfolio listings**
  - Strength: strong credibility and visual benchmarking.
  - Weakness: ranking is award-driven rather than professional-profile driven.
  - Opportunity: preserve a portfolio that is distinctive without sacrificing loading and usability.

### Content opportunity

The portfolio can outperform broad portfolio galleries by publishing real, specific reasoning:

- Problem framing
- Role and responsibilities
- Research evidence and constraints
- Before/after interface decisions
- Mobile and desktop behavior
- Component/system decisions
- Limitations and what would improve next
- Real process images

No competitor content or search volume was copied into the site.

## Heading and page plan

| Page | Primary keyword | Implemented H1 direction |
|---|---|---|
| `/` | Dipak Pahari UI/UX and Product Designer | Dipak Pahari / UI/UX Designer |
| `/about` | Dipak Pahari UI/UX Designer About | Serious About Good Design |
| `/work` | UX/UI Design Projects | UX/UI Design Projects |
| `/contact` | Contact Dipak Pahari | Have A Good Idea |
| `/work/em-collection` | Ecommerce UX/UI Case Study | EM Collection |
| `/work/xfog-of-war` | Browser Game UX/UI Case Study | XFog of War |
| `/work/irevise` | EdTech Product Design Case Study | iRevise |
| `/work/codynn` | Codynn Homepage UX/UI | Codinn |
| `/playground` | Dipak Pahari Art and Pixel Work | Playground |
| `/playground/red-light-black-dress` | Red Light Black Dress Art Process | Red Light. Black Dress. |

## Remaining manual actions

### Critical

1. Deploy Portfolio 7.0 to `https://dipakpahari.com.np`.
2. Confirm DNS and hosting serve the new build on both apex and `www`.
3. In Google Search Console:
   - Verify the apex property.
   - Submit `/sitemap.xml`.
   - Inspect `/`, `/about`, `/work`, `/contact`, and all case studies.
   - Request indexing for the most important pages.
4. Audit currently indexed URLs from the old portfolio.
5. Reconcile old `/irevise`, `/codynn`, `/savvy`, `/xfogofwar`, `/emcollection`, `/work`, and `/contact` URLs.

### High

1. Add GA4 only if there is an approved measurement ID.
2. Connect Search Console and GA4.
3. Run Google PageSpeed Insights on mobile and desktop.
4. Run Rich Results Test on `/` and a case study.
5. Test canonical and redirect behavior after deployment.
6. Review Core Web Vitals after the new build receives real field traffic.

### Medium

1. Expand EM Collection, iRevise, XFog of War and Codynn with genuine research and outcome sections.
2. Add a stronger dedicated About description in natural language.
3. Publish at least one original design-process article.
4. Add stable, crawlable image captions where artwork or process screenshots explain decisions.
5. Keep Contact, Behance and LinkedIn links consistent across the site and external profiles.

## 30-day SEO plan

### Days 1-3

- Deploy and verify the canonical domain.
- Test www/apex redirects.
- Submit the new sitemap.
- Verify robots and noindex behavior.

### Days 4-7

- Submit important URLs for indexing.
- Search `site:dipakpahari.com.np`.
- Inventory indexed old and duplicate URLs.
- Compare Search Console coverage and excluded URLs.

### Days 8-14

- Improve each case-study introduction and research/process sections.
- Update each project image preview with a real descriptive alt text.
- Publish completed project pages and remove or redirect any placeholder pages.

### Days 15-21

- Publish one genuine design-process or UX article.
- Update Behance and LinkedIn profiles with matching titles and homepage links.
- Ask real collaborators or publishers to cite completed projects.

### Days 22-30

- Review Search Console impressions and queries.
- Measure which pages receive impressions and clicks.
- Improve titles/descriptions only from observed query data.
- Run PageSpeed Insights and address genuine LCP/INP/CLS issues.

## Backlink and authority strategy

Use owned profiles and genuine relationships:

- Behance project pages linking to owned case-study URLs.
- LinkedIn profile and project posts linking to owned pages.
- Nepal design/technology communities and relevant professional directories.
- Real project collaborators, mentors and client mentions.
- Guest articles only on relevant design or technology publications.
- Avoid paid link packages, link exchanges, private blog networks and automated submissions.

# Donovan Legal PLLC Visual QA Notes

**Capture date:** 2026-06-10  
**Scope:** Browser-rendered review of homepage, contact, practice, engagement, profile, and tools pages.

## Executive read

The site has a strong premium legal-services aesthetic and a clear tax-first real estate positioning. The homepage communicates the firm’s core differentiation well: one firm integrating planning, compliance, and controversy around real estate tax work. The contact page is the most important conversion asset and is structurally usable on both desktop and mobile.

The build implication is straightforward: the website already exposes the right public taxonomy for ATHENA, GHL/ARGUS, Clio, DocuSign API, and the custom GCP email agent. The next step is not another scrape. The next step is wiring the intake path and mapping form fields/matter labels into downstream systems.

## Screenshots captured

| Page | Desktop dimensions | Mobile dimensions |
|---|---:|---:|
| Homepage | 1440 × 4607 | 390 × 6609 |
| Contact | 1440 × 2550 | 390 × 3646 |
| Practice | 1440 × 2099 | 390 × 3990 |
| Engagement | 1440 × 3558 | 390 × 6481 |
| Paul Donovan profile | 1440 × 2872 | 390 × 6192 |
| Tools | 1440 × 9939 | 390 × 27374 |

## Conversion flow observations

### Contact form

The `contact.html` page contains one public inquiry form posting to Formspree:

```text
action: https://formspree.io/f/xnjwgzkj
method: post
```

Captured fields:

| Field | Type | Required signal / notes |
|---|---|---|
| `name` | text | Label shows required. |
| `email` | email | Label shows required. |
| `phone` | tel | Optional. |
| `referral` | text | Optional; placeholder asks how the visitor heard about the firm. |
| `matter_type` | select | Label shows required. |
| `urgency` | select | Optional. |
| `description` | textarea | Label shows required; placeholder warns against confidential information. |
| submit | button | `SEND INQUIRY`. |

### Matter type options

The form’s matter-type selector already provides a useful first-pass routing taxonomy:

- Tax Planning
- Tax Compliance
- Tax Controversy
- Real Estate Transactional
- FIRPTA or International Tax
- Estate Administration
- Co-Counsel Engagement (other counsel inquiring)
- General Inquiry
- Other

### Urgency options

The urgency selector supports lightweight triage:

- Active deadline or urgent matter
- Planning ahead
- Exploring options

### Contact signals

Observed on the contact page:

- Office: 301 W. Atlantic Avenue, Suite 5, Delray Beach, Florida 33444
- Phone: (561) 666-6022
- Email: info@donovan.law
- Hours: Monday through Friday, by appointment
- Languages: English, Spanish (conversant)
- Service area: federal tax matters nationwide; state and real estate matters in Florida and Massachusetts jurisdictions of admission

## Legal-risk and intake posture

The contact page includes appropriate pre-engagement disclaimers:

- Sending a message does not establish an attorney-client relationship.
- The firm has no duty of confidentiality until conflicts check and written engagement agreement are complete.
- Visitors are instructed not to include confidential or sensitive information.
- The firm states it will follow up to schedule a conversation, run conflicts, and, if appropriate, send an engagement letter.

This language should be preserved when moving from Formspree to GHL/ARGUS, ATHENA, or any custom GCP email-agent flow.

## Design and UX observations

- **Homepage:** Strong first impression, premium visual language, clear practice-area cards, strong “One Firm. Full Cycle Representation. No Handoffs.” differentiator.
- **Contact page:** Clear legal disclaimer, visible contact information, and a structured form. The page works on mobile, though the disclaimer and form create a long vertical path.
- **Mobile navigation:** Mobile shows a compact hamburger menu and nested practice toggle. Verify tap behavior manually before production changes.
- **Tools page:** Very long on mobile. Useful content, but likely needs subnavigation or segmentation if it becomes a primary conversion path.
- **Top whitespace / load behavior:** Initial screenshot tooling captured large blank upper areas on some pages before full-page Playwright capture. Keep an eye on image loading, hero spacing, and page-load stability in browser QA.

## Agent and CRM handoff implications

The current form taxonomy can be mapped directly into downstream routing:

| Website field / signal | GHL/ARGUS | ATHENA | Clio | Custom GCP email agent |
|---|---|---|---|---|
| `matter_type` | Lead pipeline category | Call prompt/context | Matter type candidate after approval | Email classification label |
| `urgency` | Priority tag | Escalation prompt | Task/deadline review flag | Triage priority |
| `description` | Lead note | Conversation context | Communication log after approval | Summary/extraction source |
| `referral` | Attribution/source | Optional context | Contact source note | Metadata |
| disclaimer acknowledgment | Compliance note | Voice disclaimer alignment | Engagement boundary | Approval/safe-response policy |

## Immediate next steps

1. Replace or bridge Formspree with the chosen GHL/ARGUS intake endpoint, unless Formspree is intentionally retained as a temporary collector.
2. Preserve the contact-page disclaimer verbatim or have counsel approve any rewritten version before wiring agent automation.
3. Map `matter_type` values to GHL pipeline stages, ATHENA voice prompts, Clio custom fields, and custom GCP email labels.
4. Decide whether “Active deadline or urgent matter” triggers immediate human notification, ATHENA callback flow, or both.
5. Run a manual click-through QA pass for mobile menu behavior, contact form validation, and post-submit behavior before launch.

## Limitations

- No form was submitted.
- Screenshots are full-page browser captures, not a full accessibility audit.
- This pass did not inspect analytics tags, schema markup, page performance, or search indexing.

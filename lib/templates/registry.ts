import type { Template, Field } from "./types";

// ─── Stage 01 — Client Intake Form ──────────────────────────────
const intakeForm: Template = {
  id: "intake_form",
  title: "Client Intake Form",
  stage: 1,
  audience: "client",
  description:
    "Complete this form before your onboarding session. Your answers build your full client database.",
  sections: [
    {
      key: "basics",
      title: "Business & Brand Basics",
      description:
        "The foundation of your business — used to build your company profile and research your competitive landscape.",
      fields: [
        { key: "industry", label: "Industry / Sector", type: "text", required: true, placeholder: "e.g. Fashion, Hospitality, SaaS…" },
        { key: "yearsInBusiness", label: "Years in Business", type: "text", placeholder: "e.g. Launched 2019 / 6 years" },
        { key: "geographicMarket", label: "Geographic Market", type: "text", required: true, placeholder: "Where do you operate and where are your customers?" },
        { key: "websiteUrl", label: "Website URL", type: "text", placeholder: "https://…" },
        { key: "whatYouSell", label: "What do you sell?", type: "textarea", required: true, rows: 4, placeholder: "List your main products or services. Be specific — include names and rough price ranges if possible." },
        { key: "whatMakesYouDifferent", label: "What makes you genuinely different?", type: "textarea", required: true, rows: 3, placeholder: "Not marketing language — the real reason a customer picks you over someone else." },
        { key: "marketPositioning", label: "Market Positioning", type: "select", required: true, options: [
          { value: "", label: "Select…" },
          { value: "luxury", label: "Luxury" },
          { value: "premium", label: "Premium" },
          { value: "luxury_adjacent", label: "Luxury-adjacent" },
          { value: "mid_range", label: "Mid-range" },
          { value: "affordable", label: "Affordable" },
          { value: "budget", label: "Budget" },
        ]},
        { key: "currentChallenge", label: "Current biggest challenge", type: "textarea", rows: 3, placeholder: "What is the main business or marketing problem you're trying to solve right now?" },
      ],
    },
    {
      key: "services",
      title: "Services & Pricing Detail",
      description: "List your key services or products. Populates your services database.",
      fields: [
        {
          key: "serviceList",
          label: "Services / Products",
          type: "repeatable",
          defaultRows: 3,
          columns: [
            { key: "name", label: "Service / Product Name", type: "text" },
            { key: "price", label: "Price / Range", type: "text" },
            { key: "isMostPopular", label: "Most Popular?", type: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
            { key: "description", label: "Brief Description", type: "text" },
          ],
        },
        { key: "discountPrograms", label: "Discount / Loyalty Programs", type: "textarea", rows: 2, placeholder: "e.g. seasonal discounts, loyalty cards, referral bonuses, packages" },
        { key: "mostProfitable", label: "Most Profitable Service/Product", type: "text", placeholder: "Which offering generates the most revenue or margin?" },
      ],
    },
    {
      key: "customer",
      title: "Your Customer",
      description: "Seeds your audience and persona database.",
      fields: [
        // First, branch on whether customers are consumers (B2C) or businesses (B2B).
        { key: "customerType", label: "Who are your customers?", type: "radio", required: true, options: [
          { value: "b2c", label: "B2C — I sell to consumers / individuals" },
          { value: "b2b", label: "B2B — I sell to other businesses" },
        ]},

        // ── B2C questions ──
        { key: "bestCustomer", label: "Who is your best customer?", type: "textarea", required: true, rows: 3, placeholder: "Describe them in 2–3 sentences — who they are, what they do, what stage of life they're in.", showIf: { field: "customerType", equals: "b2c" } },
        { key: "ageRange", label: "Age Range", type: "text", placeholder: "e.g. 25–45 primary, 45–60 secondary", showIf: { field: "customerType", equals: "b2c" } },
        { key: "gender", label: "Gender", type: "text", placeholder: "e.g. Primarily female / Mixed", showIf: { field: "customerType", equals: "b2c" } },
        { key: "location", label: "Location", type: "text", placeholder: "City, region, country — where are most of your customers?", showIf: { field: "customerType", equals: "b2c" } },
        { key: "problemYouSolve", label: "What problem do you solve for them?", type: "textarea", required: true, rows: 3, placeholder: "What pain or frustration brings them to you?", showIf: { field: "customerType", equals: "b2c" } },
        { key: "whyChooseYou", label: "Why do they choose you over competitors?", type: "textarea", rows: 2, placeholder: "In their own words if possible.", showIf: { field: "customerType", equals: "b2c" } },
        { key: "brandsCustomerLoves", label: "3 Brands Your Customer Already Loves", type: "text", placeholder: "Not in your industry — brands whose aesthetic or values your customer admires.", showIf: { field: "customerType", equals: "b2c" } },

        // ── B2B questions (temporary set — will be refined later) ──
        { key: "idealBusinessTypes", label: "What types of businesses are your ideal customers?", type: "textarea", rows: 3, placeholder: "e.g. Boutique hotels, mid-size law firms, DTC fashion brands…", showIf: { field: "customerType", equals: "b2b" } },
        { key: "decisionMaker", label: "Who is usually the decision-maker when purchasing your product or service?", type: "textarea", rows: 2, placeholder: "e.g. Marketing director, founder, procurement lead…", showIf: { field: "customerType", equals: "b2b" } },
        { key: "businessProblems", label: "What are the main business problems your customers are trying to solve?", type: "textarea", rows: 3, placeholder: "The business outcomes they're chasing or pains they're removing.", showIf: { field: "customerType", equals: "b2b" } },
        { key: "salesProcessLength", label: "How long does the typical decision or sales process take?", type: "text", placeholder: "e.g. 2 weeks / 3–6 months", showIf: { field: "customerType", equals: "b2b" } },
        { key: "whyChooseYouB2B", label: "What usually influences a business to choose you over another provider?", type: "textarea", rows: 2, placeholder: "Price, expertise, relationship, results…", showIf: { field: "customerType", equals: "b2b" } },
      ],
    },
    {
      key: "brand",
      title: "Brand Identity & Voice",
      description: "Seeds your messaging database — key messages, brand voice rules, tone guidelines.",
      fields: [
        { key: "brandEssence", label: "Brand Voice — Guiding Sentence", type: "textarea", required: true, rows: 2, placeholder: "In one sentence, how should your brand sound when it speaks? e.g. 'We sound like a confident expert who explains things simply and never talks down to people.'" },
        { key: "brandPersonality", label: "Brand Personality in 3 Words", type: "text", placeholder: "e.g. Bold, Precise, Human" },
        { key: "overallTone", label: "Overall Tone", type: "text", placeholder: "e.g. Confident and understated / Warm and expert / Playful and direct" },
        { key: "neverSoundLike", label: "What you NEVER want to sound like", type: "textarea", rows: 2, placeholder: "Describe the tone, words, or style that would feel completely wrong." },
        { key: "existingTagline", label: "Existing Tagline / Slogan", type: "text", placeholder: "Leave blank if none" },
        { key: "phrasesToNeverUse", label: "Words / Phrases to NEVER Use", type: "textarea", rows: 2, placeholder: "e.g. 'game-changing', 'seamless', 'BUY NOW'…" },
      ],
    },
    {
      key: "competitors",
      title: "Competitors",
      description: "List your top 3–5 competitors. We'll research them — just give us the names and your honest view.",
      fields: [
        {
          key: "competitorList",
          label: "Competitors",
          type: "repeatable",
          defaultRows: 3,
          columns: [
            { key: "name", label: "Competitor Name / URL", type: "text" },
            { key: "theirStrength", label: "Their Strength (why people use them)", type: "text" },
            { key: "whereYouBeatThem", label: "Where You Beat Them", type: "text" },
          ],
        },
      ],
    },
    {
      key: "goals",
      title: "Goals & Strategy",
      description: "Seeds your objectives, KPIs, and strategic calendar.",
      fields: [
        { key: "primaryGoal", label: "Primary Business Goal Right Now", type: "textarea", required: true, rows: 2, placeholder: "The single most important thing you are trying to achieve in the next 6–12 months." },
        { key: "successIn6Months", label: "Success in 6 Months Looks Like…", type: "textarea", rows: 2, placeholder: "Be specific — numbers, outcomes, milestones." },
        { key: "monthlyRevenueTarget", label: "Monthly Revenue Target", type: "text", placeholder: "Current or goal — or leave blank." },
        { key: "marketingChannels", label: "Marketing Channels Currently Active", type: "text", placeholder: "e.g. Instagram, Google Ads, Email, TikTok…" },
        { key: "monthlyBudgetRange", label: "Monthly Marketing Budget Range", type: "select", options: [
          { value: "", label: "Select…" },
          { value: "under_1k", label: "Under €1k" },
          { value: "1k_5k", label: "€1k – €5k" },
          { value: "5k_15k", label: "€5k – €15k" },
          { value: "15k_plus", label: "€15k+" },
          { value: "not_sharing", label: "Prefer not to say" },
        ]},
        { key: "anythingElse", label: "Anything else we should know?", type: "textarea", rows: 3, placeholder: "Seasonal patterns, upcoming launches, things that have not worked before…" },
      ],
    },
    // Contact & Digital Presence section removed — those details are now
    // collected earlier in the Initial Client Form.
  ],
};

// ─── Stage 02 — Scope of Work ────────────────────────────────────
const scopeOfWork: Template = {
  id: "scope_of_work",
  title: "Scope of Work",
  stage: 2,
  audience: "team",
  description: "Lays out exactly what is being built. Client reads and signs before Stage 03.",
  sections: [
    {
      key: "details",
      title: "Project Details",
      fields: [
        { key: "preparedBy", label: "Prepared By", type: "text", required: true },
        { key: "dateIssued", label: "Date Issued", type: "date", required: true },
        { key: "projectType", label: "Project Type", type: "select", required: true, options: [
          { value: "website", label: "Website" },
          { value: "software_crm", label: "Software / CRM" },
          { value: "branding", label: "Branding" },
          { value: "marketing", label: "Marketing" },
          { value: "other", label: "Other" },
        ]},
      ],
    },
    {
      key: "overview",
      title: "Project Overview",
      fields: [
        { key: "projectOverview", label: "Overview", type: "textarea", required: true, rows: 5, placeholder: "Briefly describe what this project is and what it will achieve." },
      ],
    },
    {
      key: "deliverables",
      title: "What We Are Building",
      description: "Everything listed below will be designed, built, and delivered.",
      fields: [
        { key: "buildItems", label: "Deliverables", type: "repeatable", defaultRows: 3, columns: [
          { key: "item", label: "Item", type: "text", placeholder: "e.g. Homepage design" },
          { key: "detail", label: "Detail", type: "text", placeholder: "e.g. Responsive, mobile-first" },
        ]},
      ],
    },
    {
      key: "handover",
      title: "What You Will Receive",
      fields: [
        { key: "handoverItems", label: "Handover Items", type: "repeatable", defaultRows: 3, columns: [
          { key: "deliverable", label: "Deliverable", type: "text", placeholder: "e.g. Live site" },
          { key: "format", label: "Format", type: "text", placeholder: "e.g. URL" },
          { key: "when", label: "When", type: "text", placeholder: "e.g. Stage 07" },
        ]},
      ],
    },
    {
      key: "timeline",
      title: "Timeline",
      fields: [
        { key: "milestones", label: "Milestones", type: "repeatable", defaultRows: 4, columns: [
          { key: "milestone", label: "Milestone", type: "text", placeholder: "e.g. Scope of Work signed" },
          { key: "targetDate", label: "Target Date", type: "date" },
        ]},
      ],
    },
    {
      key: "signature",
      title: "Confirmation",
      description: "By signing, the client confirms they have read this document and are happy for work to begin.",
      fields: [
        { key: "clientSignature", label: "Client Sign-off", type: "signature" },
        { key: "teamSignature", label: "Zero-Point Representative", type: "signature", teamOnly: true } as Field & { teamOnly: boolean },
      ],
    },
  ],
};

// ─── Stage 03 — Internal Review Checklist (also used in Stage 04) ─
const internalReview: Template = {
  id: "internal_review",
  title: "Internal Review Checklist",
  stage: 3,
  audience: "team",
  description: "Complete before anything goes to the client. This is a gate — not a formality.",
  sections: [
    {
      key: "details",
      title: "Job Details",
      fields: [
        { key: "stage", label: "Stage", type: "select", required: true, options: [
          { value: "stage_03", label: "Stage 03 — Sketch" },
          { value: "stage_04", label: "Stage 04 — Make" },
        ]},
        { key: "reviewer", label: "Reviewer", type: "text", required: true },
        { key: "date", label: "Date", type: "date", required: true },
        { key: "versionRound", label: "Version / Round", type: "text", placeholder: "e.g. v1, Round 2" },
      ],
    },
    {
      key: "brief_alignment",
      title: "Brief Alignment",
      fields: [
        { key: "briefAddresses", label: "The work addresses everything in the client brief.", type: "checklistItem" },
        { key: "noMissed", label: "No features, pages, or elements from the brief have been missed.", type: "checklistItem" },
        { key: "noExtra", label: "Nothing has been added that was not in the brief or agreed with the client.", type: "checklistItem" },
        { key: "projectTypeAccounted", label: "The project type has been accounted for.", type: "checklistItem" },
      ],
    },
    {
      key: "sketch_checks",
      title: "Stage 03 — Sketch (skip at Stage 04)",
      fields: [
        { key: "sketchCoversAllPages", label: "Sketches / wireframes cover all agreed pages or screens.", type: "checklistItem" },
        { key: "userFlowLogical", label: "User flow and navigation logic make sense.", type: "checklistItem" },
        { key: "layoutHierarchyClear", label: "Layout hierarchy is clear — what is the primary action on each screen?", type: "checklistItem" },
        { key: "contentAreasAccountedFor", label: "Content areas are accounted for — headings, body, CTAs, media, forms.", type: "checklistItem" },
        { key: "mobileApproachIndicated", label: "Mobile / responsive approach is indicated or noted.", type: "checklistItem" },
        { key: "assumptionsDocumented", label: "Any assumptions made during sketching are documented.", type: "checklistItem" },
      ],
    },
    {
      key: "make_checks",
      title: "Stage 04 — Make (skip at Stage 03)",
      fields: [
        { key: "consistentWithSketches", label: "Designs are consistent with the approved sketches from Stage 03.", type: "checklistItem" },
        { key: "brandGuidelinesFollowed", label: "Brand guidelines have been followed — fonts, colours, logo usage.", type: "checklistItem" },
        { key: "allStatesDesigned", label: "All states are designed: hover, active, empty, error, loading (where relevant).", type: "checklistItem" },
        { key: "responsiveComplete", label: "Responsive / mobile version is complete or accounted for.", type: "checklistItem" },
        { key: "placeholdersClearlyMarked", label: "All copy placeholders are clearly marked if final copy has not been supplied.", type: "checklistItem" },
        { key: "assetsLicensed", label: "Images and assets used are either supplied by client, licensed, or clearly placeholder.", type: "checklistItem" },
        { key: "designFileOrganised", label: "Design file is organised — layers named, components used correctly.", type: "checklistItem" },
      ],
    },
    {
      key: "quality",
      title: "Quality & Completeness",
      fields: [
        { key: "spellingChecked", label: "Spelling and grammar have been checked on all visible text.", type: "checklistItem" },
        { key: "nothingBroken", label: "Nothing is obviously broken, misaligned, or unfinished.", type: "checklistItem" },
        { key: "looksComplete", label: "The work looks complete — no placeholders left without being flagged.", type: "checklistItem" },
        { key: "comfortableIfClientSaw", label: "We would be comfortable if the client saw this right now.", type: "checklistItem" },
      ],
    },
    {
      key: "handover_readiness",
      title: "Handover Readiness",
      fields: [
        { key: "correctVersion", label: "The file or link being sent to the client is the correct, latest version.", type: "checklistItem" },
        { key: "contextNoted", label: "Any context the client needs to review properly has been noted.", type: "checklistItem" },
        { key: "feedbackFormReady", label: "The Sketch Feedback Form (Stage 03) or Feedback & Revision Request Form (Stage 04) is ready to send alongside.", type: "checklistItem" },
        { key: "deadlineAgreed", label: "Deadline for client feedback has been agreed or is being communicated.", type: "checklistItem" },
      ],
    },
    {
      key: "issues",
      title: "Fails & Issues to Resolve",
      description: "List any items that failed. Do not send to client until all are resolved.",
      fields: [
        { key: "issueLog", label: "Issues", type: "repeatable", defaultRows: 2, columns: [
          { key: "issue", label: "Issue", type: "text" },
          { key: "owner", label: "Owner", type: "text" },
          { key: "resolved", label: "Resolved", type: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
        ]},
      ],
    },
    {
      key: "outcome",
      title: "Outcome",
      fields: [
        { key: "outcome", label: "Outcome", type: "radio", required: true, options: [
          { value: "ready", label: "Ready to send to client — all checks passed." },
          { value: "ready_with_notes", label: "Ready to send — minor issues noted, consciously signed off." },
          { value: "not_ready", label: "Not ready — issues must be resolved before sending." },
        ]},
        { key: "reviewer", label: "Reviewed by", type: "signature" },
      ],
    },
  ],
};

// ─── Stage 03 — Sketch Feedback (client) ─────────────────────────
const sketchFeedback: Template = {
  id: "sketch_feedback",
  title: "Sketch Feedback",
  stage: 3,
  audience: "client",
  description:
    "We've shared our initial sketches. This form captures your feedback so we can move forward in the right direction. It should take around 5 minutes.",
  sections: [
    {
      key: "first_reaction",
      title: "Your First Reaction",
      description: "Before getting into specifics — how do you feel about the direction overall?",
      fields: [
        { key: "overallDirection", label: "Overall direction", type: "radio", required: true, options: [
          { value: "love_it", label: "Love it — let's go" },
          { value: "on_track", label: "On the right track" },
          { value: "not_there", label: "Not quite there yet" },
        ]},
        { key: "firstImpressionNotes", label: "Anything else on first impression?", type: "textarea", rows: 3, placeholder: "Optional — only if something specific stands out straight away." },
      ],
    },
    {
      key: "page_feedback",
      title: "Page by Page Feedback",
      description: "Go through each page or screen we sent you.",
      fields: [
        { key: "pages", label: "Pages / Screens", type: "repeatable", defaultRows: 3, columns: [
          { key: "name", label: "Page / Screen Name", type: "text", placeholder: "e.g. Homepage" },
          { key: "feeling", label: "Overall Feeling", type: "select", options: [
            { value: "happy", label: "Happy with this" },
            { value: "small_changes", label: "Small changes needed" },
            { value: "rethinking", label: "Needs rethinking" },
          ]},
          { key: "feedback", label: "Your Feedback", type: "text", placeholder: "What works, what doesn't, anything specific to change." },
        ]},
      ],
    },
    {
      key: "direction",
      title: "Direction for Stage 04",
      description: "Helps us understand what to carry forward into the full designs.",
      fields: [
        { key: "layoutApproach", label: "Layout approach", type: "radio", options: [
          { value: "stick_with_it", label: "Stick with this layout" },
          { value: "adjust", label: "Adjust — see notes" },
          { value: "try_different", label: "Try a different approach" },
        ]},
        { key: "visualFeelTone", label: "Visual feel / tone", type: "radio", options: [
          { value: "happy", label: "Happy with direction" },
          { value: "needs_discussion", label: "Needs discussion" },
          { value: "not_sure", label: "Not sure yet" },
        ]},
        { key: "stage04Notes", label: "Anything you want us to prioritise or change in Stage 04?", type: "textarea", rows: 3, placeholder: "e.g. The homepage layout works but the navigation needs to be simpler. Keep the overall structure." },
      ],
    },
    {
      key: "content_assets",
      title: "Content & Assets",
      description: "A quick check on what you need to send us before we start building the full designs.",
      fields: [
        { key: "finalCopy", label: "Final copy (text)", type: "select", options: [
          { value: "already_sent", label: "Already sent" },
          { value: "will_send", label: "Will send soon" },
          { value: "need_help", label: "We need help with this" },
        ]},
        { key: "images", label: "Images / photography", type: "select", options: [
          { value: "already_sent", label: "Already sent" },
          { value: "will_send", label: "Will send soon" },
          { value: "placeholders", label: "Use placeholders for now" },
        ]},
        { key: "logoFiles", label: "Logo / brand files", type: "select", options: [
          { value: "already_sent", label: "Already sent" },
          { value: "will_send", label: "Will send soon" },
          { value: "use_existing", label: "Use existing files" },
        ]},
      ],
    },
    {
      key: "anything_else",
      title: "Anything Else?",
      fields: [
        { key: "anythingElse", label: "Any other questions, concerns, or things you want us to know?", type: "textarea", rows: 3, placeholder: "Optional — leave blank if nothing else to add." },
      ],
    },
    {
      key: "submitted_by",
      title: "Submitted By",
      fields: [
        { key: "clientSignature", label: "Your sign-off", type: "signature" },
      ],
    },
  ],
};

// ─── Stage 04 — Feedback & Revision Request (client) ─────────────
const feedbackRevision: Template = {
  id: "feedback_revision",
  title: "Feedback & Revision Request",
  stage: 4,
  audience: "client",
  description:
    "We've shared the full designs. Go through them, tell us what you're happy with and what you'd like changed, then send it back.",
  sections: [
    {
      key: "verdict",
      title: "Overall Verdict",
      description: "Before the detail — how do you feel about the designs as a whole?",
      fields: [
        { key: "overallVerdict", label: "Overall verdict", type: "radio", required: true, options: [
          { value: "approved", label: "Approved — happy to proceed to build. No changes needed." },
          { value: "approved_with_revisions", label: "Approved with revisions — minor changes, then proceed without another review." },
          { value: "revisions_required", label: "Revisions required — please review again before moving forward." },
        ]},
      ],
    },
    {
      key: "revisions",
      title: "Revision Requests",
      description: "List each change you would like. Be as specific as possible — the clearer you are, the faster we can turn it around.",
      fields: [
        { key: "revisionList", label: "Revisions", type: "repeatable", defaultRows: 4, columns: [
          { key: "pageScreen", label: "Page / Screen", type: "text", placeholder: "e.g. Homepage" },
          { key: "whatToChange", label: "What would you like changed?", type: "text", placeholder: "Be specific" },
        ]},
      ],
    },
    {
      key: "specific_areas",
      title: "Specific Areas",
      description: "Tick anything you want us to pay particular attention to.",
      fields: [
        { key: "specificAreas", label: "Areas of focus", type: "checkboxGroup", options: [
          { value: "layout", label: "Layout / structure" },
          { value: "colours", label: "Colours" },
          { value: "typography", label: "Typography / fonts" },
          { value: "spacing", label: "Spacing & padding" },
          { value: "images", label: "Images / visuals" },
          { value: "copy", label: "Copy / wording" },
          { value: "navigation", label: "Navigation / menus" },
          { value: "forms_buttons", label: "Forms / buttons" },
          { value: "mobile", label: "Mobile / responsive view" },
          { value: "other", label: "Something else (see notes)" },
        ]},
      ],
    },
    {
      key: "happy_with",
      title: "What You Are Happy With",
      description: "Optional but useful — let us know what's working so we don't accidentally change it.",
      fields: [
        { key: "happyWith", label: "What is working well?", type: "textarea", rows: 3, placeholder: "e.g. The homepage hero looks great. The colour palette feels right." },
      ],
    },
    {
      key: "anything_else",
      title: "Anything Else?",
      fields: [
        { key: "anythingElse", label: "Any other questions or comments?", type: "textarea", rows: 2, placeholder: "Optional." },
      ],
    },
    {
      key: "submitted_by",
      title: "Submitted By",
      fields: [
        { key: "clientSignature", label: "Your sign-off", type: "signature" },
      ],
    },
  ],
};

// ─── Stage 05 — QA Checklist ─────────────────────────────────────
const qaChecklist: Template = {
  id: "qa_checklist",
  title: "QA Checklist",
  stage: 5,
  audience: "team",
  description:
    "Complete the section(s) relevant to your project type. Nothing moves to client review until QA is signed off.",
  sections: [
    {
      key: "details",
      title: "Job Details",
      fields: [
        { key: "qaReviewer", label: "QA Reviewer", type: "text", required: true },
        { key: "date", label: "Date", type: "date", required: true },
        { key: "buildVersion", label: "Build / Version", type: "text", placeholder: "e.g. v1.0, staging link" },
        { key: "projectType", label: "Project Type", type: "checkboxGroup", options: [
          { value: "website", label: "Website" },
          { value: "software", label: "Software / CRM" },
          { value: "branding", label: "Branding" },
          { value: "marketing", label: "Marketing" },
        ]},
      ],
    },
    {
      key: "website",
      title: "Website",
      description: "Not a website project? Skip this section.",
      fields: [
        { key: "allPagesExist", label: "All agreed pages exist and are accessible.", type: "checklistItem" },
        { key: "noPlaceholderText", label: "No placeholder text (Lorem Ipsum) remains.", type: "checklistItem" },
        { key: "imagesPresent", label: "All images are present, correctly sized, and not broken.", type: "checklistItem" },
        { key: "allLinksWork", label: "All links work — internal navigation, external links, CTAs.", type: "checklistItem" },
        { key: "formsSubmit", label: "Forms submit correctly and send to the right email/system.", type: "checklistItem" },
        { key: "404Exists", label: "404 page exists and is styled.", type: "checklistItem" },
        { key: "desktopLayout", label: "Layout is correct on desktop (1280px+).", type: "checklistItem" },
        { key: "tabletLayout", label: "Layout is correct on tablet (768px).", type: "checklistItem" },
        { key: "mobileLayout", label: "Layout is correct on mobile (375px).", type: "checklistItem" },
        { key: "testedChrome", label: "Tested in Chrome (latest).", type: "checklistItem" },
        { key: "testedSafari", label: "Tested in Safari (latest).", type: "checklistItem" },
        { key: "testedFirefox", label: "Tested in Firefox (latest).", type: "checklistItem" },
        { key: "noHorizScroll", label: "No horizontal scroll on any screen size.", type: "checklistItem" },
        { key: "pageLoadTime", label: "Page load time is acceptable (under 3s on standard connection).", type: "checklistItem" },
        { key: "imagesCompressed", label: "Images are compressed / optimised.", type: "checklistItem" },
        { key: "sslActive", label: "SSL certificate is active (HTTPS).", type: "checklistItem" },
        { key: "noConsoleErrors", label: "Console has no critical JavaScript errors.", type: "checklistItem" },
        { key: "trackingInstalled", label: "Google Analytics or agreed tracking is installed and firing.", type: "checklistItem" },
        { key: "sitemapExists", label: "Sitemap.xml exists and is accessible.", type: "checklistItem" },
        { key: "robotsTxt", label: "Robots.txt is configured correctly.", type: "checklistItem" },
        { key: "faviconSet", label: "Favicon is set.", type: "checklistItem" },
        { key: "pageTitlesSet", label: "Page titles are set for all pages.", type: "checklistItem" },
        { key: "metaDescriptions", label: "Meta descriptions are set for all pages.", type: "checklistItem" },
        { key: "headingHierarchy", label: "Heading hierarchy is correct (one H1 per page).", type: "checklistItem" },
        { key: "altText", label: "All images have alt text.", type: "checklistItem" },
        { key: "cmsSetUp", label: "CMS is set up and client access credentials are ready.", type: "checklistItem" },
        { key: "clientEditableAreas", label: "Client-editable areas are working correctly.", type: "checklistItem" },
      ],
    },
    {
      key: "software",
      title: "Software / CRM",
      description: "Not a software project? Skip this section.",
      fields: [
        { key: "allFeaturesBuilt", label: "All features listed in the brief / scope are built.", type: "checklistItem" },
        { key: "noStubbedFeatures", label: "No agreed feature is missing or stubbed out.", type: "checklistItem" },
        { key: "userRolesWork", label: "All user roles and permissions work as specified.", type: "checklistItem" },
        { key: "inputValidation", label: "All data inputs are validated (no empty required fields accepted).", type: "checklistItem" },
        { key: "dataOutputsCorrect", label: "All data outputs are displaying correctly.", type: "checklistItem" },
        { key: "noCriticalBugs", label: "No critical or blocker bugs remain.", type: "checklistItem" },
        { key: "edgeCasesTested", label: "Edge cases have been tested (empty states, max input, error states).", type: "checklistItem" },
        { key: "integrationsConnected", label: "All third-party integrations are connected and tested.", type: "checklistItem" },
        { key: "authWorks", label: "Authentication (login/logout) works as expected.", type: "checklistItem" },
        { key: "stagingStable", label: "Staging environment is stable and accessible to client.", type: "checklistItem" },
        { key: "uatReady", label: "UAT test cases / scenarios are documented and ready.", type: "checklistItem" },
        { key: "noSensitiveDataExposed", label: "No sensitive data is exposed in frontend code or logs.", type: "checklistItem" },
        { key: "sslActiveStaging", label: "SSL is active on staging environment.", type: "checklistItem" },
      ],
    },
    {
      key: "branding",
      title: "Branding",
      description: "Not a branding project? Skip this section.",
      fields: [
        { key: "allDeliverablesPresent", label: "All deliverables from the brief are present (logo, colour palette, typography, etc.).", type: "checklistItem" },
        { key: "logoFormats", label: "Logo is supplied in all required formats: SVG, PNG (transparent), PDF.", type: "checklistItem" },
        { key: "logoVariants", label: "Logo variants supplied: primary, reversed/white, icon-only (if agreed).", type: "checklistItem" },
        { key: "colourPalette", label: "Colour palette document includes HEX, RGB, and CMYK values.", type: "checklistItem" },
        { key: "typographyDoc", label: "Typography document includes font names, weights, and licensing info.", type: "checklistItem" },
        { key: "brandGuidelinesComplete", label: "Brand guidelines document is complete (if in scope).", type: "checklistItem" },
        { key: "filesNamedClearly", label: "All files are named clearly and consistently.", type: "checklistItem" },
        { key: "printResolution", label: "Any print-ready files are exported at correct resolution (300 DPI minimum).", type: "checklistItem" },
        { key: "cmykColours", label: "Print files use CMYK colour mode (not RGB).", type: "checklistItem" },
        { key: "sourceFilesIncluded", label: "All source files are included (Illustrator, Figma, etc.).", type: "checklistItem" },
      ],
    },
    {
      key: "marketing",
      title: "Marketing",
      description: "Not a marketing project? Skip this section.",
      fields: [
        { key: "trackingPixels", label: "Tracking pixels / tags are installed and verified (Meta, Google, etc.).", type: "checklistItem" },
        { key: "conversionEventsFiring", label: "Conversion events are firing correctly.", type: "checklistItem" },
        { key: "utmParameters", label: "UTM parameters are set up for all campaign links.", type: "checklistItem" },
        { key: "copyProofread", label: "All copy has been proofread — no spelling or grammar errors.", type: "checklistItem" },
        { key: "visualsCorrectSize", label: "All visuals are correct size and format for the platform.", type: "checklistItem" },
        { key: "brandGuidelinesFollowed", label: "Brand guidelines have been followed.", type: "checklistItem" },
        { key: "contentScheduled", label: "All content is scheduled or ready to publish on the correct date/time.", type: "checklistItem" },
        { key: "adCreativesSpec", label: "All ad creatives meet platform spec (dimensions, file size, character counts).", type: "checklistItem" },
        { key: "landingPagesLive", label: "Landing pages linked from ads are live and load correctly.", type: "checklistItem" },
      ],
    },
    {
      key: "bugs",
      title: "Bugs & Issues Log",
      description: "Log any failures found during QA. Resolve all critical issues before client review.",
      fields: [
        { key: "bugLog", label: "Bugs", type: "repeatable", defaultRows: 3, columns: [
          { key: "severity", label: "Severity", type: "select", options: [
            { value: "critical", label: "Critical" },
            { value: "major", label: "Major" },
            { value: "minor", label: "Minor" },
          ]},
          { key: "description", label: "Description", type: "text" },
          { key: "owner", label: "Owner", type: "text" },
          { key: "fixed", label: "Fixed", type: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
        ]},
      ],
    },
    {
      key: "outcome",
      title: "QA Outcome",
      fields: [
        { key: "outcome", label: "Outcome", type: "radio", required: true, options: [
          { value: "passed", label: "Passed — ready for client review. All checks passed. No critical or major issues." },
          { value: "passed_with_minor", label: "Passed with minor issues — proceed with note. No critical issues. Minor items logged and accepted." },
          { value: "failed", label: "Failed — issues must be resolved before client review." },
        ]},
        { key: "signedBy", label: "Signed off by", type: "signature" },
      ],
    },
  ],
};

// ─── Stage 05 — Dev / Production Handoff ─────────────────────────
const devHandoff: Template = {
  id: "dev_handoff",
  title: "Dev / Production Handoff",
  stage: 5,
  audience: "team",
  description:
    "Completed by the lead developer before handoff. Everything the next person needs without asking questions.",
  sections: [
    {
      key: "details",
      title: "Project Details",
      fields: [
        { key: "leadDeveloper", label: "Lead Developer", type: "text", required: true },
        { key: "date", label: "Date", type: "date", required: true },
        { key: "version", label: "Version", type: "text", placeholder: "e.g. v1.0" },
      ],
    },
    {
      key: "staging",
      title: "Staging Environment",
      fields: [
        { key: "stagingUrl", label: "Staging URL", type: "text", placeholder: "https://staging.example.com" },
        { key: "stagingUsername", label: "Username", type: "text" },
        { key: "stagingPassword", label: "Password", type: "text", hint: "Use agreed vault for actual credentials." },
        { key: "stagingNotes", label: "Notes", type: "textarea", rows: 2 },
      ],
    },
    {
      key: "production",
      title: "Production Environment",
      fields: [
        { key: "productionUrl", label: "Production URL", type: "text", placeholder: "https://www.example.com" },
        { key: "hostingProvider", label: "Hosting Provider", type: "text", placeholder: "e.g. Vercel, AWS, WP Engine" },
        { key: "serverRegion", label: "Server / Region", type: "text" },
        { key: "dnsProvider", label: "DNS Provider", type: "text" },
        { key: "sslStatus", label: "SSL", type: "select", options: [
          { value: "active", label: "Active" },
          { value: "pending", label: "Pending" },
          { value: "not_configured", label: "Not yet configured" },
        ]},
        { key: "controlPanelUrl", label: "Control Panel URL", type: "text" },
      ],
    },
    {
      key: "credentials",
      title: "Access & Credentials",
      description: "Do not leave credentials in plain text in final filed documents. Use agreed vault.",
      fields: [
        { key: "credentialsList", label: "Third-Party Services", type: "repeatable", defaultRows: 3, columns: [
          { key: "service", label: "Service", type: "text", placeholder: "e.g. Stripe" },
          { key: "account", label: "Account / Login", type: "text" },
          { key: "notes", label: "Notes", type: "text", placeholder: "e.g. Test / live mode" },
        ]},
      ],
    },
    {
      key: "tech_stack",
      title: "Tech Stack",
      fields: [
        { key: "framework", label: "Framework / CMS", type: "text", placeholder: "e.g. Next.js, WordPress" },
        { key: "languages", label: "Language(s)", type: "text" },
        { key: "styling", label: "Styling", type: "text", placeholder: "e.g. Tailwind CSS" },
        { key: "database", label: "Database", type: "text" },
        { key: "ciCd", label: "CI / CD", type: "text" },
        { key: "packageManager", label: "Package Manager", type: "text" },
        { key: "nodePhpVersion", label: "Node / PHP version", type: "text" },
        { key: "keyDependencies", label: "Key Dependencies", type: "textarea", rows: 2, placeholder: "e.g. Prisma, Stripe SDK — list anything critical." },
        { key: "repoUrl", label: "Repo URL", type: "text" },
        { key: "branch", label: "Branch", type: "text", placeholder: "e.g. main" },
      ],
    },
    {
      key: "known_issues",
      title: "Known Issues & Notes for the Team",
      fields: [
        { key: "knownIssues", label: "Notes", type: "textarea", rows: 4, placeholder: "Quirks, workarounds, outstanding items, or things to watch out for." },
      ],
    },
    {
      key: "post_launch",
      title: "Post-Launch Tasks",
      description: "Items to complete after the site is live.",
      fields: [
        { key: "submitSitemap", label: "Submit sitemap to Google Search Console.", type: "checkbox" },
        { key: "confirmAnalytics", label: "Confirm Google Analytics is receiving live traffic.", type: "checkbox" },
        { key: "setupUptime", label: "Set up uptime monitoring.", type: "checkbox" },
        { key: "removeTestData", label: "Remove any staging / test data from production database.", type: "checkbox" },
        { key: "disableStaging", label: "Disable / remove staging environment or password-protect it.", type: "checkbox" },
        { key: "sendHandover", label: "Send Delivery Handover Document to client.", type: "checkbox" },
        { key: "archiveProject", label: "Archive project files and update internal records.", type: "checkbox" },
      ],
    },
    {
      key: "signoff",
      title: "Signed Off By",
      fields: [
        { key: "developerSignoff", label: "Lead Developer", type: "signature" },
        { key: "projectLeadSignoff", label: "Project Lead", type: "signature" },
      ],
    },
  ],
};

// ─── Stage 06 — Review & Sign-off (client) ───────────────────────
const reviewSignoff: Template = {
  id: "review_signoff",
  title: "Review & Sign-off",
  stage: 6,
  audience: "client",
  description:
    "Everything is built. Before we launch, we need your formal sign-off. Your signature confirms you're happy with the work and authorises us to proceed to launch.",
  sections: [
    {
      key: "what_to_review",
      title: "What You Are Reviewing",
      description:
        "Go through the project using the link we've shared. For each item below, tick Approved if you're happy with it. If something needs changing, leave a note.",
      fields: [
        { key: "deliverableChecks", label: "Deliverables", type: "repeatable", defaultRows: 4, columns: [
          { key: "deliverable", label: "Deliverable", type: "text", placeholder: "e.g. All pages / screens" },
          { key: "approved", label: "Approved?", type: "select", options: [
            { value: "yes", label: "✓ Approved" },
            { value: "no", label: "Changes needed" },
          ]},
          { key: "notes", label: "Notes (if not approved)", type: "text" },
        ]},
      ],
    },
    {
      key: "final_notes",
      title: "Any Final Notes",
      description: "Optional — only if you have something specific to flag before signing.",
      fields: [
        { key: "finalNotes", label: "Notes", type: "textarea", rows: 3 },
      ],
    },
    {
      key: "signoff",
      title: "Client Sign-off",
      description:
        "By signing, you confirm you have reviewed the completed work, are satisfied it matches what was agreed, and authorise Zero-Point to proceed to launch. Any changes after this point will be treated as new work.",
      fields: [
        { key: "clientSignature", label: "Client sign-off", type: "signature", required: true },
      ],
    },
  ],
};

// ─── Stage 07 — Launch / Delivery Checklist ──────────────────────
const launchChecklist: Template = {
  id: "launch_checklist",
  title: "Launch / Delivery Checklist",
  stage: 7,
  audience: "team",
  description:
    "Run through this checklist on launch day. Do not skip steps.",
  sections: [
    {
      key: "details",
      title: "Job Details",
      fields: [
        { key: "launchLead", label: "Launch Lead", type: "text", required: true },
        { key: "launchDate", label: "Launch Date", type: "date", required: true },
        { key: "stage06Signed", label: "Stage 06 Review & Sign-off confirmed", type: "checkbox", required: true },
      ],
    },
    {
      key: "pre_launch",
      title: "Pre-Launch — Before Going Live",
      description: "Complete all of these before flipping the switch.",
      fields: [
        { key: "stage06FormSigned", label: "Stage 06 Review & Sign-off Form is signed by the client.", type: "checklistItem" },
        { key: "qaChecklistComplete", label: "QA Checklist (Stage 05) is complete and signed off.", type: "checklistItem" },
        { key: "devHandoffComplete", label: "Dev / Production Handoff Doc is complete.", type: "checklistItem" },
        { key: "allRevisionsImplemented", label: "All revision requests from Stage 04 have been implemented and confirmed.", type: "checklistItem" },
        { key: "noPlaceholders", label: "All copy is final — no placeholders remaining.", type: "checklistItem" },
        { key: "mediaOptimised", label: "All images and media are correctly placed and optimised.", type: "checklistItem" },
        { key: "contactDetailsCorrect", label: "Contact details, addresses, and phone numbers are correct.", type: "checklistItem" },
        { key: "allLinksLive", label: "All links are live and pointing to the correct destinations.", type: "checklistItem" },
        { key: "legalPagesInPlace", label: "Legal pages are in place: Privacy Policy, Terms, Cookie notice (if applicable).", type: "checklistItem" },
        { key: "envVarsSet", label: "Production environment variables are set correctly.", type: "checklistItem" },
        { key: "sslActive", label: "SSL certificate is active and valid on the production domain.", type: "checklistItem" },
      ],
    },
    {
      key: "launch",
      title: "Launch",
      description: "The go-live steps — take these in order.",
      fields: [
        { key: "dnsUpdated", label: "DNS records updated to point to production server.", type: "checklistItem" },
        { key: "domainResolves", label: "Domain is resolving correctly to the live site.", type: "checklistItem" },
        { key: "httpsWorking", label: "HTTPS is working on all variants of the domain.", type: "checklistItem" },
        { key: "siteAccessible", label: "Site / software / deliverable is publicly accessible.", type: "checklistItem" },
        { key: "keyPagesTested", label: "Key pages / screens tested on desktop and mobile.", type: "checklistItem" },
        { key: "formsTestedProd", label: "Forms and core functionality tested on production.", type: "checklistItem" },
        { key: "integrationsTestedProd", label: "Any third-party integrations tested on production.", type: "checklistItem" },
        { key: "trackingFiringProd", label: "Google Analytics or agreed tracking is firing on production.", type: "checklistItem" },
        { key: "noConsoleErrors", label: "No console errors on production.", type: "checklistItem" },
      ],
    },
    {
      key: "post_launch",
      title: "Post-Launch",
      description: "Complete these within 24 hours of going live.",
      fields: [
        { key: "clientNotified", label: "Client notified that the project is live.", type: "checklistItem" },
        { key: "handoverDocSent", label: "Delivery Handover Document sent to client.", type: "checklistItem" },
        { key: "clientAccessConfirmed", label: "Client login credentials and CMS access confirmed (if applicable).", type: "checklistItem" },
        { key: "uptimeMonitoring", label: "Uptime monitoring is active.", type: "checklistItem" },
        { key: "sitemapSubmitted", label: "Sitemap submitted to Google Search Console (websites only).", type: "checklistItem" },
        { key: "testDataRemoved", label: "All test accounts and data removed from production.", type: "checklistItem" },
        { key: "projectFilesArchived", label: "Project files archived to agreed internal storage.", type: "checklistItem" },
        { key: "portalMarkedLaunched", label: "Project marked as launched in the portal.", type: "checklistItem" },
        { key: "invoiceRaised", label: "Invoice raised if not already done.", type: "checklistItem" },
      ],
    },
    {
      key: "outcome",
      title: "Launch Outcome",
      fields: [
        { key: "outcome", label: "Outcome", type: "radio", required: true, options: [
          { value: "launched", label: "Launched successfully — all checks complete. Project is live. Client notified." },
          { value: "launched_with_items", label: "Launched with minor items outstanding. Follow-up tasks noted. Complete within 24 hours." },
          { value: "delayed", label: "Launch delayed — issues to resolve. Do not mark as launched until blockers are cleared." },
        ]},
        { key: "signedBy", label: "Signed off by", type: "signature" },
      ],
    },
  ],
};

// ─── Stage 07 — Delivery Handover ────────────────────────────────
const deliveryHandover: Template = {
  id: "delivery_handover",
  title: "Delivery Handover",
  stage: 7,
  audience: "team",
  description:
    "Your project is complete. This is the client's reference for everything delivered — what was built, where to find files, access details, and what happens next.",
  sections: [
    {
      key: "details",
      title: "Project Summary",
      fields: [
        { key: "deliveredBy", label: "Delivered By", type: "text", required: true },
        { key: "deliveryDate", label: "Delivery Date", type: "date", required: true },
      ],
    },
    {
      key: "what_delivered",
      title: "What Was Delivered",
      description: "A complete list of everything included in this project.",
      fields: [
        { key: "deliverablesList", label: "Deliverables", type: "repeatable", defaultRows: 3, columns: [
          { key: "deliverable", label: "Deliverable", type: "text", placeholder: "e.g. Live website" },
          { key: "whereTo", label: "Where to find it", type: "text", placeholder: "e.g. https://yoursite.com" },
          { key: "notes", label: "Notes", type: "text" },
        ]},
      ],
    },
    {
      key: "access",
      title: "Access & Login Details",
      description: "Keep this document secure. Change passwords after first login.",
      fields: [
        { key: "accessList", label: "Access Details", type: "repeatable", defaultRows: 3, columns: [
          { key: "service", label: "Service / System", type: "text", placeholder: "e.g. Website CMS" },
          { key: "loginDetails", label: "Login / Access Details", type: "text", placeholder: "URL | User | Password (or vault ref)" },
        ]},
      ],
    },
    {
      key: "files",
      title: "File Locations",
      fields: [
        { key: "sourceFiles", label: "Source files", type: "text", placeholder: "Link to Dropbox / Google Drive…" },
        { key: "designFiles", label: "Design files", type: "text", placeholder: "Figma link or shared folder" },
        { key: "brandAssets", label: "Brand assets", type: "text", placeholder: "Logos, fonts, colour guide — folder link" },
        { key: "codeRepository", label: "Code repository", type: "text", placeholder: "GitHub / GitLab link — if applicable" },
        { key: "documentation", label: "Documentation", type: "text", placeholder: "Attached to this document or separate link" },
      ],
    },
    {
      key: "tech",
      title: "Technical Notes — Software & Website Projects",
      description: "Not a website or software project? Skip this section.",
      fields: [
        { key: "builtWith", label: "Built with", type: "text", placeholder: "e.g. WordPress, Next.js, Laravel" },
        { key: "hostedOn", label: "Hosted on", type: "text" },
        { key: "domainManagedVia", label: "Domain managed via", type: "text" },
        { key: "keyIntegrations", label: "Key integrations", type: "text", placeholder: "e.g. Stripe, Mailchimp, Google Maps" },
        { key: "maintenanceNotes", label: "Maintenance & Updates", type: "textarea", rows: 3, placeholder: "Things to be aware of to keep the project running smoothly." },
        { key: "trainingHeld", label: "Training held", type: "select", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
        { key: "trainingNotes", label: "Training Notes", type: "textarea", rows: 2 },
      ],
    },
    {
      key: "contact",
      title: "Your Contact at Zero-Point",
      fields: [
        { key: "contactName", label: "Name", type: "text" },
        { key: "contactEmail", label: "Email", type: "text" },
        { key: "contactPhone", label: "Phone", type: "text" },
      ],
    },
  ],
};

// ─── Onboarding — Initial Client Form ────────────────────────────
// Short first form the team can pre-fill before the client sees it. Contact
// details collected here are intentionally removed from the full intake form.
const initialClientForm: Template = {
  id: "initial_client_form",
  title: "Initial Client Form",
  stage: 1,
  audience: "client",
  description:
    "A few quick details to get your project started. Your team may have pre-filled some answers — approve them or change them as needed.",
  sections: [
    {
      key: "contact",
      title: "Basic Contact Information",
      description: "How we reach you and where to find you online.",
      fields: [
        { key: "name", label: "Name", type: "text", required: true, placeholder: "Your full name" },
        { key: "businessName", label: "Business Name", type: "text", required: true, placeholder: "Your company / brand name" },
        { key: "businessAddress", label: "Business Address", type: "textarea", rows: 2, placeholder: "Full address including country" },
        { key: "phoneNumbers", label: "Phone Number(s)", type: "text", placeholder: "Main line + WhatsApp if applicable" },
        { key: "primaryEmail", label: "Primary Email", type: "text", required: true, placeholder: "The email customers contact you through" },
        { key: "instagram", label: "Instagram", type: "text", placeholder: "@handle" },
        { key: "tiktok", label: "TikTok", type: "text", placeholder: "@handle" },
        { key: "facebook", label: "Facebook Page", type: "text", placeholder: "URL or page name" },
        { key: "linkedin", label: "LinkedIn", type: "text", placeholder: "Company page URL" },
        { key: "youtube", label: "YouTube Channel", type: "text", placeholder: "URL or channel name" },
        { key: "googleBusiness", label: "Google Business Profile", type: "text", placeholder: "Confirmed / Not set up / URL" },
        { key: "otherPlatforms", label: "Other Platforms", type: "text", placeholder: "e.g. Pinterest, Tripadvisor, Booking.com…" },
      ],
    },
    {
      key: "project_info",
      title: "Project Information",
      description: "Tell us what you're looking to build and why.",
      fields: [
        { key: "definitionOfProject", label: "Definition of project", type: "textarea", required: true, rows: 3, placeholder: "In your own words, what is this project?" },
        { key: "mainGoal", label: "Main goal", type: "textarea", required: true, rows: 2, placeholder: "The single most important outcome you want from this project." },
        { key: "keyFunctions", label: "Key functions", type: "textarea", rows: 3, placeholder: "The main things it needs to do." },
        { key: "strategyOfGrowth", label: "Strategy of growth", type: "textarea", rows: 3, placeholder: "How do you see this helping the business grow?" },
        { key: "timeFrame", label: "Time frame", type: "text", placeholder: "e.g. Launch before Q3 / 8–10 weeks" },
        { key: "additionalInformation", label: "Additional information", type: "textarea", rows: 3, placeholder: "Anything else we should know at this stage." },
      ],
    },
  ],
};

// ─── Onboarding — Project / Financial Offer ──────────────────────
// Temporary offer template (team-authored, client approves the whole thing).
const financialOffer: Template = {
  id: "financial_offer",
  title: "Project / Financial Offer",
  stage: 1,
  audience: "team",
  description: "Our proposed scope, timeline, and price for your project.",
  sections: [
    {
      key: "offer",
      title: "Project / Financial Offer",
      fields: [
        { key: "project", label: "Project", type: "text", required: true, placeholder: "Project name" },
        { key: "projectOverview", label: "Project Overview", type: "textarea", required: true, rows: 4, placeholder: "Short description" },
        { key: "scope", label: "Scope", type: "textarea", required: true, rows: 4, placeholder: "Scope of work" },
        { key: "timeFrame", label: "Time Frame", type: "text", placeholder: "Estimated time frame" },
        { key: "price", label: "Price", type: "text", required: true, placeholder: "Price" },
        { key: "additionalInformation", label: "Additional Information", type: "textarea", rows: 3, placeholder: "Additional information" },
      ],
    },
  ],
};

// ─── Registry ─────────────────────────────────────────────────────
export const TEMPLATES: Record<string, Template> = {
  intake_form: intakeForm,
  initial_client_form: initialClientForm,
  financial_offer: financialOffer,
  scope_of_work: scopeOfWork,
  internal_review: internalReview,
  sketch_feedback: sketchFeedback,
  feedback_revision: feedbackRevision,
  qa_checklist: qaChecklist,
  dev_handoff: devHandoff,
  review_signoff: reviewSignoff,
  launch_checklist: launchChecklist,
  delivery_handover: deliveryHandover,
};

// Which templates are active at each stage, and who fills them
export const STAGE_TEMPLATES: Record<
  number,
  { id: string; audience: "client" | "team"; label: string }[]
> = {
  1: [{ id: "intake_form", audience: "client", label: "Client Intake Form" }],
  // Scope of Work now lives inside the Brief (Brief → Scope → Tasks). The old
  // standalone Stage-2 document is retired; existing scope_of_work docs are kept
  // for history but no new ones are offered here.
  2: [],
  3: [],
  4: [],
  5: [
    { id: "qa_checklist", audience: "team", label: "QA Checklist" },
    { id: "dev_handoff", audience: "team", label: "Dev Handoff" },
  ],
  6: [{ id: "review_signoff", audience: "client", label: "Review & Sign-off" }],
  7: [
    { id: "launch_checklist", audience: "team", label: "Launch Checklist" },
    { id: "delivery_handover", audience: "team", label: "Delivery Handover" },
  ],
};

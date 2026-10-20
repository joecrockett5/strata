using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using Strata.Domain.Publishing;

namespace Strata.Infrastructure.Seeding.Demo;

/// <summary>
/// Seed content for the fictional "Harbor &amp; Pine Wealth Partners": ten section types expressed in
/// the content model (exactly what a designer could build in the section designer), a starter
/// template and the document the demo site is copied from. Pure: no I/O, so tests can validate it.
/// </summary>
public static class HarborPine
{
    public const string FirmName = "Harbor & Pine Wealth Partners";
    public const string TemplateName = "Harbor & Pine Advisor";
    public const string TemplateDescription = "A calm, trustworthy site for an independent advisory firm: services, team, process, FAQ and contact, with a locked compliance footer.";
    public const string DemoSiteSlug = "harbor-pine";

    public static Theme Theme { get; } = new(
        new ThemeColors(
            Primary: "#16384d",
            OnPrimary: "#ffffff",
            Secondary: "#2f5d50",
            Accent: "#c2893b",
            Background: "#ffffff",
            Surface: "#f2f5f3",
            Text: "#1b2427",
            MutedText: "#56636a"),
        new ThemeFonts(FontStack.Transitional, FontStack.Humanist),
        ThemeRadius.Small);

    /// <summary>Generated placeholder images used as defaults and in the template.</summary>
    public sealed record Images(Guid Logo, Guid Hero, Guid About, IReadOnlyList<Guid> Team);

    /// <summary>A section type to create: name, category and definition.</summary>
    public sealed record SectionSpec(string Key, string Name, string Category, SectionDefinition Definition);

    // ---------------------------------------------------------------------------------------
    // Slot and node helpers (designer-style building blocks)

    private static TextSlotDefinition Text(string key, string label, string text, int? maxLength = null, bool required = false, SlotMode mode = SlotMode.Editable) =>
        new() { Key = key, Label = label, Mode = mode, Required = required, MaxLength = maxLength, Default = new TextValue(text) };

    private static RichTextSlotDefinition Rich(string key, string label, string html, SlotMode mode = SlotMode.Editable, int? maxLength = null) =>
        new() { Key = key, Label = label, Mode = mode, Required = false, MaxLength = maxLength, Default = new RichTextValue(html) };

    private static ImageSlotDefinition Image(string key, string label, string alt, Guid? mediaId = null, bool required = false) =>
        new() { Key = key, Label = label, Mode = SlotMode.Editable, Required = required, Default = new ImageValue(mediaId, alt) };

    private static LinkSlotDefinition Link(string key, string label) =>
        new() { Key = key, Label = label, Mode = SlotMode.Editable, Required = false, Default = new LinkValue(null) };

    private static HeadingNode Heading(string id, int level, TextSlotDefinition text, Align align = Align.Start) =>
        new() { Id = id, Level = level, Align = align, Text = text };

    private static RichTextNode RichText(string id, RichTextSlotDefinition content, Align align = Align.Start) =>
        new() { Id = id, Align = align, Content = content };

    private static ButtonNode Button(string id, string labelKey, string label, string linkKey, ButtonVariant variant = ButtonVariant.Primary, Align align = Align.Start) =>
        new() { Id = id, Variant = variant, Align = align, Label = Text(labelKey, "Button label", label, maxLength: 40, required: true), Link = Link(linkKey, "Button link") };

    private static StackNode Stack(string id, Spacing gap, CrossAlign align, params Node[] children) =>
        new() { Id = id, Gap = gap, Align = align, Children = children };

    private static ColumnsNode Columns(string id, ColumnRatio ratio, CrossAlign valign, Breakpoint stackAt, params Node[][] columns) =>
        new() { Id = id, Ratio = ratio, Gap = Spacing.Xl, Valign = valign, StackAt = stackAt, Columns = [.. columns.Select(c => new Column(c))] };

    private static SectionDefinition Section(SectionBackground background, Spacing padding, ContentWidth width, ImageSlotDefinition? backgroundImage, params Node[] children) =>
        new() { Root = new SectionNode { Id = "root", Background = background, BackgroundImage = backgroundImage, PaddingY = padding, Width = width, Children = children } };

    // ---------------------------------------------------------------------------------------
    // Section types

    public static IReadOnlyList<SectionSpec> Sections(Images images) =>
    [
        new("header", "Site header", "Header", Section(SectionBackground.Background, Spacing.Sm, ContentWidth.Wide, null,
            Columns("c", ColumnRatio.ThreeOne, CrossAlign.Center, Breakpoint.Mobile,
                [new NavNode { Id = "nav" }],
                [Button("cta", "ctaLabel", "Book a call", "ctaLink", align: Align.End)]))),

        new("hero", "Hero with image", "Hero", Section(SectionBackground.Primary, Spacing.Xxl, ContentWidth.Standard,
            Image("backgroundImage", "Background image", "Calm harbour at first light", images.Hero),
            Stack("s", Spacing.Md, CrossAlign.Start,
                Heading("h", 1, Text("headline", "Headline", "Plan with confidence", maxLength: 80, required: true)),
                RichText("sub", Rich("subtext", "Subtext", "<p>Independent, fee-only advice for families and business owners who want a clear plan and a steady hand.</p>", maxLength: 300)),
                Button("cta", "ctaLabel", "Book an introductory call", "ctaLink", ButtonVariant.Secondary)))),

        new("services", "Services grid", "Services", Section(SectionBackground.Background, Spacing.Xl, ContentWidth.Standard, null,
            Heading("h", 2, Text("servicesTitle", "Title", "How we help", maxLength: 80)),
            RichText("intro", Rich("servicesIntro", "Introduction", "<p>One relationship for the decisions that shape your financial life.</p>")),
            new RepeaterNode
            {
                Id = "r", Key = "services", ItemLabel = "Service", Min = 1, Max = 9, DefaultItemCount = 3, Layout = RepeaterLayout.Grid3, Gap = Spacing.Lg,
                Children =
                [
                    Heading("n", 3, Text("serviceName", "Service name", "Financial planning", maxLength: 60, required: true)),
                    RichText("d", Rich("serviceSummary", "Summary", "<p>A written plan that connects your goals, cash flow, taxes and investments.</p>", maxLength: 400)),
                ],
            })),

        new("about", "About and philosophy", "About", Section(SectionBackground.Surface, Spacing.Xl, ContentWidth.Standard, null,
            Columns("c", ColumnRatio.Half, CrossAlign.Center, Breakpoint.Tablet,
                [new ImageNode { Id = "i", Aspect = ImageAspect.FourThree, Fit = ImageFit.Cover, Radius = ImageRadius.Theme, Image = Image("aboutImage", "Image", "Pine forest above the harbour", images.About) }],
                [
                    Heading("h", 2, Text("aboutTitle", "Title", "Our philosophy", maxLength: 80)),
                    RichText("b", Rich("aboutBody", "Body", "<p>We believe good advice starts with listening. Our recommendations are guided by your goals, not by products or commissions.</p><ul><li>Fee-only and independent</li><li>Plans in plain language</li><li>Long-term relationships</li></ul>")),
                    Button("cta", "aboutCtaLabel", "Meet the team", "aboutCtaLink", ButtonVariant.Link),
                ]))),

        new("team", "Team bios", "Team", Section(SectionBackground.Background, Spacing.Xl, ContentWidth.Standard, null,
            Heading("h", 2, Text("teamTitle", "Title", "Meet the team", maxLength: 80)),
            new RepeaterNode
            {
                Id = "r", Key = "team", ItemLabel = "Team member", Min = 1, Max = 12, DefaultItemCount = 3, Layout = RepeaterLayout.Grid3, Gap = Spacing.Lg,
                Children =
                [
                    new ImageNode { Id = "p", Aspect = ImageAspect.Square, Fit = ImageFit.Cover, Radius = ImageRadius.Full, Image = Image("photo", "Photo", "Portrait of a team member", required: true) },
                    Heading("n", 3, Text("name", "Name", "Team member", maxLength: 60, required: true)),
                    RichText("t", Rich("role", "Title", "<p><em>Wealth advisor</em></p>", maxLength: 80)),
                    RichText("b", Rich("bio", "Bio", "<p>A short introduction to this advisor’s background and focus.</p>", maxLength: 600)),
                ],
            })),

        new("process", "Our process", "Process", Section(SectionBackground.Surface, Spacing.Xl, ContentWidth.Standard, null,
            Heading("h", 2, Text("processTitle", "Title", "Our process", maxLength: 80)),
            new RepeaterNode
            {
                Id = "r", Key = "steps", ItemLabel = "Step", Min = 2, Max = 6, DefaultItemCount = 4, Layout = RepeaterLayout.Grid4, Gap = Spacing.Lg,
                Children =
                [
                    Heading("n", 3, Text("stepTitle", "Step title", "1. Discover", maxLength: 60, required: true)),
                    RichText("d", Rich("stepDetail", "Detail", "<p>What happens in this step.</p>", maxLength: 300)),
                ],
            })),

        new("faq", "Frequently asked questions", "FAQ", Section(SectionBackground.Background, Spacing.Xl, ContentWidth.Narrow, null,
            Heading("h", 2, Text("faqTitle", "Title", "Frequently asked questions", maxLength: 80)),
            new RepeaterNode
            {
                Id = "r", Key = "faqs", ItemLabel = "Question", Min = 1, Max = 15, DefaultItemCount = 3, Layout = RepeaterLayout.Stack, Gap = Spacing.Md,
                Children =
                [
                    Heading("q", 3, Text("question", "Question", "How do you charge?", maxLength: 140, required: true)),
                    RichText("a", Rich("answer", "Answer", "<p>A transparent flat fee, agreed up front.</p>", maxLength: 1000)),
                ],
            })),

        new("cta", "Call to action band", "Call to action", Section(SectionBackground.Primary, Spacing.Xl, ContentWidth.Narrow, null,
            Stack("s", Spacing.Md, CrossAlign.Center,
                Heading("h", 2, Text("ctaTitle", "Title", "Ready for a clearer plan?", maxLength: 80), Align.Center),
                RichText("b", Rich("ctaBody", "Body", "<p>A 30-minute introductory call, with no obligation.</p>"), Align.Center),
                Button("cta", "ctaLabel", "Book a call", "ctaLink", ButtonVariant.Secondary, Align.Center)))),

        new("contact", "Contact", "Contact", Section(SectionBackground.Background, Spacing.Xl, ContentWidth.Standard, null,
            Columns("c", ColumnRatio.OneTwo, CrossAlign.Start, Breakpoint.Tablet,
                [
                    Heading("h", 2, Text("contactTitle", "Title", "Visit or write to us", maxLength: 80)),
                    RichText("o", Rich("officeDetails", "Office details", "<p>Office address<br>Phone number<br>Opening hours</p>")),
                ],
                [new ContactFormNode { Id = "f", SubmitLabel = Text("submitLabel", "Submit label", "Send message", maxLength: 40, required: true), SuccessMessage = Text("successMessage", "Success message", "Thank you. We will reply within one business day.", maxLength: 200, required: true) }]))),

        new("footer", "Site footer", "Footer", Section(SectionBackground.Surface, Spacing.Lg, ContentWidth.Wide, null,
            Columns("c", ColumnRatio.Half, CrossAlign.Start, Breakpoint.Mobile,
                [RichText("a", Rich("footerAbout", "About the firm", "<p><strong>Harbor &amp; Pine Wealth Partners</strong><br>Independent financial planning and investment management.</p>"))],
                [RichText("ct", Rich("footerContact", "Contact details", "<p>14 Quay Street, Port Halden<br>(555) 014-2290 · hello@harborpine.example</p>"))]),
            new DividerNode { Id = "d" },
            // The compliance team owns this wording: site owners can never change it (rule 1).
            RichText("disc", Rich("disclosure", "Regulatory disclosure",
                "<p>Harbor &amp; Pine Wealth Partners is a fictional registered investment adviser used for demonstration. Advisory services are offered only where the firm is appropriately registered or exempt. Investing involves risk, including the possible loss of principal. Past performance does not guarantee future results. Nothing on this site is an offer to buy or sell securities or personalised advice.</p>",
                SlotMode.Locked)),
            RichText("cr", Rich("copyright", "Copyright", "<p>© 2026 Harbor &amp; Pine Wealth Partners</p>")))),
    ];

    // ---------------------------------------------------------------------------------------
    // Template document

    private static Dictionary<string, SlotValue> V(params (string Key, SlotValue Value)[] values) => values.ToDictionary(v => v.Key, v => v.Value);

    private static RichTextValue Html(string html) => new(html);

    private static TextValue Plain(string text) => new(text);

    private static RepeaterItem Item(params (string Key, SlotValue Value)[] values) => new(Guid.NewGuid(), V(values));

    /// <summary>Another use of the same content: fresh instance and item ids, optionally fewer items.</summary>
    private static SectionInstance Fresh(SectionInstance instance, int? takeItems = null) => instance with
    {
        Id = Guid.NewGuid(),
        Repeaters = instance.Repeaters.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyList<RepeaterItem>)[.. kv.Value.Take(takeItems ?? int.MaxValue).Select(i => i with { Id = Guid.NewGuid() })]),
    };

    /// <summary>
    /// The template document: Home, About, Services, Contact. The header and the contact section
    /// are required, the footer is locked, and the brand colours are locked.
    /// </summary>
    public static SiteDocument TemplateDocument(IReadOnlyDictionary<string, SectionVersionRef> refs, Images images)
    {
        SectionInstance Use(string key, SectionLock lockMode = SectionLock.None, Dictionary<string, SlotValue>? values = null, Dictionary<string, IReadOnlyList<RepeaterItem>>? repeaters = null) => new()
        {
            Id = Guid.NewGuid(),
            SectionTypeId = refs[key].SectionTypeId,
            Version = refs[key].Version,
            Lock = lockMode,
            Values = values ?? [],
            Repeaters = repeaters ?? [],
        };

        Guid home = Guid.NewGuid(), about = Guid.NewGuid(), services = Guid.NewGuid(), contact = Guid.NewGuid();
        LinkValue To(Guid pageId) => new(new PageLinkTarget(pageId));

        SectionInstance Hero(string headline, string subtext, string cta, Guid? linkTo = null) => Use("hero", values: V(
            ("headline", Plain(headline)),
            ("subtext", Html($"<p>{subtext}</p>")),
            ("ctaLabel", Plain(cta)),
            ("ctaLink", To(linkTo ?? contact))));

        var servicesGrid = Use("services", repeaters: new()
        {
            ["services"] =
            [
                Item(("serviceName", Plain("Financial planning")), ("serviceSummary", Html("<p>A written plan that ties together cash flow, savings, insurance, tax and estate decisions, reviewed every year.</p>"))),
                Item(("serviceName", Plain("Investment management")), ("serviceSummary", Html("<p>Diversified, low-cost portfolios built around your plan, rebalanced with discipline and reported clearly.</p>"))),
                Item(("serviceName", Plain("Retirement income")), ("serviceSummary", Html("<p>A sustainable paycheque in retirement: withdrawal strategy, pension and benefit timing, and tax-aware drawdown.</p>"))),
                Item(("serviceName", Plain("Business owner planning")), ("serviceSummary", Html("<p>Owner compensation, retirement plans for your team and a roadmap for succession or sale.</p>"))),
                Item(("serviceName", Plain("Estate and legacy")), ("serviceSummary", Html("<p>Working alongside your attorney so beneficiaries, trusts and gifting reflect what matters to you.</p>"))),
                Item(("serviceName", Plain("Education funding")), ("serviceSummary", Html("<p>Realistic savings targets and account choices for children and grandchildren.</p>"))),
            ],
        });

        var process = Use("process", repeaters: new()
        {
            ["steps"] =
            [
                Item(("stepTitle", Plain("1. Discover")), ("stepDetail", Html("<p>An unhurried conversation about your goals, worries and what a good life looks like for you.</p>"))),
                Item(("stepTitle", Plain("2. Design")), ("stepDetail", Html("<p>We analyse where you stand and present a written plan with clear, prioritised recommendations.</p>"))),
                Item(("stepTitle", Plain("3. Implement")), ("stepDetail", Html("<p>We handle the paperwork and coordinate with your accountant and attorney.</p>"))),
                Item(("stepTitle", Plain("4. Review")), ("stepDetail", Html("<p>Regular check-ins keep the plan current as life, markets and laws change.</p>"))),
            ],
        });

        var faq = Use("faq", repeaters: new()
        {
            ["faqs"] =
            [
                Item(("question", Plain("How are you paid?")), ("answer", Html("<p>We are fee-only. You pay a flat annual planning fee, plus an asset-based fee if we manage investments. We receive no commissions.</p>"))),
                Item(("question", Plain("Is there a minimum to work with you?")), ("answer", Html("<p>No asset minimum for planning. We are a good fit for people who want ongoing advice rather than a single transaction.</p>"))),
                Item(("question", Plain("Who holds my money?")), ("answer", Html("<p>Your accounts are held in your name at an independent custodian. We can advise and trade, but never withdraw funds to ourselves.</p>"))),
                Item(("question", Plain("How often will we meet?")), ("answer", Html("<p>Usually two to four times a year, in person at our Quay Street office or by video, plus whenever something changes.</p>"))),
            ],
        });

        var team = Use("team", repeaters: new()
        {
            ["team"] =
            [
                Item(("photo", new ImageValue(images.Team[0], "Portrait of Maren Holt")), ("name", Plain("Maren Holt")), ("role", Html("<p><em>Founding Partner, CFP®</em></p>")),
                    ("bio", Html("<p>Maren spent fifteen years at a large brokerage before founding Harbor &amp; Pine to give clients advice without a sales agenda.</p>"))),
                Item(("photo", new ImageValue(images.Team[1], "Portrait of Daniel Okafor")), ("name", Plain("Daniel Okafor")), ("role", Html("<p><em>Partner, Chartered Financial Analyst</em></p>")),
                    ("bio", Html("<p>Daniel leads our investment committee and believes the best portfolio is the one you can stick with.</p>"))),
                Item(("photo", new ImageValue(images.Team[2], "Portrait of Priya Raman")), ("name", Plain("Priya Raman")), ("role", Html("<p><em>Senior Planner, Enrolled Agent</em></p>")),
                    ("bio", Html("<p>Priya specialises in retirement income and tax planning, and runs our popular annual planning workshop.</p>"))),
            ],
        });

        var cta = Use("cta", values: V(("ctaLink", To(contact))));

        return new SiteDocument
        {
            Settings = new SiteSettings { FirmName = FirmName, Logo = new ImageValue(images.Logo, "Harbor & Pine Wealth Partners logo") },
            Theme = Theme,
            ThemeLocks = [ThemeToken.Primary, ThemeToken.Secondary],
            Header = Use("header", SectionLock.Required, V(("ctaLink", To(contact)))),
            Footer = Use("footer", SectionLock.Locked),
            Pages =
            [
                new Page
                {
                    Id = home, Title = "Home", Slug = string.Empty,
                    Seo = new PageSeo("Harbor & Pine Wealth Partners | Independent financial advice", "Fee-only financial planning and investment management for families and business owners in Port Halden."),
                    Sections =
                    [
                        Hero("Plan with confidence", "Independent, fee-only advice for families and business owners who want a clear plan and a steady hand.", "Book an introductory call"),
                        Fresh(servicesGrid, takeItems: 3),
                        Use("about", values: V(("aboutCtaLink", To(about)))),
                        process,
                        cta,
                    ],
                },
                new Page
                {
                    Id = about, Title = "About", Slug = "about",
                    Seo = new PageSeo("About us | Harbor & Pine Wealth Partners", "Who we are, what we believe and the advisors you will work with."),
                    Sections =
                    [
                        Hero("Independent advice, rooted in place", "Founded in Port Halden in 2009, we serve a few hundred families with the same care we would want for our own.", "Talk to an advisor"),
                        Use("about", values: V(
                            ("aboutTitle", Plain("What we believe")),
                            ("aboutBody", Html("<p>Money is a tool for living well. Our job is to help you see clearly, decide calmly and stay on course when markets are noisy.</p><ul><li>We are fiduciaries, always acting in your interest</li><li>We explain our reasoning and our fees</li><li>We would rather lose a sale than give poor advice</li></ul>")),
                            ("aboutCtaLabel", Plain("See our services")),
                            ("aboutCtaLink", To(services)))),
                        team,
                        Fresh(cta),
                    ],
                },
                new Page
                {
                    Id = services, Title = "Services", Slug = "services",
                    Seo = new PageSeo("Services | Harbor & Pine Wealth Partners", "Financial planning, investment management, retirement income and more."),
                    Sections =
                    [
                        Hero("Advice for every chapter", "From your first plan to passing on a legacy, one team that knows your whole picture.", "Book a call"),
                        servicesGrid,
                        Fresh(process),
                        faq,
                    ],
                },
                new Page
                {
                    Id = contact, Title = "Contact", Slug = "contact",
                    Seo = new PageSeo("Contact | Harbor & Pine Wealth Partners", "Book an introductory call or send us a message."),
                    Sections =
                    [
                        Hero("Let’s talk", "Tell us a little about yourself and we will arrange a no-obligation introductory call.", "See our services", services),
                        Use("contact", SectionLock.Required, V(
                            ("officeDetails", Html("<p><strong>Harbor &amp; Pine Wealth Partners</strong><br>14 Quay Street, Suite 3<br>Port Halden</p><p>(555) 014-2290<br><a href=\"mailto:hello@harborpine.example\">hello@harborpine.example</a></p><p>Monday to Friday, 8:30–5:00</p>")))),
                        Fresh(faq, takeItems: 2),
                    ],
                },
            ],
        };
    }

    /// <summary>
    /// Every problem the API would report for this content: definition rules, document validation
    /// (with the images counted as usable media) and blocking publish-check errors. Empty when valid.
    /// </summary>
    public static IReadOnlyList<string> Verify(IReadOnlyList<SectionSpec> sections, IReadOnlyDictionary<string, SectionVersionRef> refs, SiteDocument document, Images images)
    {
        var problems = new List<string>();
        foreach (var spec in sections)
        {
            problems.AddRange(SectionDefinitionRules.Validate(spec.Definition).Select(v => $"{spec.Name}: {v.Code} at {v.Path}: {v.Message}"));
        }

        var published = sections.ToDictionary(
            s => refs[s.Key],
            s => new PublishedSection(refs[s.Key], s.Name, s.Category, s.Definition, typeArchived: false));
        var media = new HashSet<Guid>([images.Logo, images.Hero, images.About, .. images.Team]);
        problems.AddRange(SiteDocumentValidator.Validate(document, new ContentValidationContext(published, media)).Select(v => $"document: {v.Code} at {v.Path}: {v.Message}"));

        var definitions = published.ToDictionary(kv => kv.Key.ToString(), kv => kv.Value.Definition, StringComparer.Ordinal);
        problems.AddRange(PublishChecks.Run(document, definitions).Where(i => i.Severity == IssueSeverity.Error).Select(i => $"publish: {i.Code} at {i.Path}: {i.Message}"));
        return problems;
    }
}

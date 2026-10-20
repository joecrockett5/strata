using Strata.Domain.Content;
using Strata.Domain.Publishing;
using static Strata.Testing.Content;

namespace Strata.Domain.Tests;

public sealed class PublishChecksTests
{
    private static readonly SectionVersionRef HeroRef = new(Guid.NewGuid(), 1);
    private static readonly SectionVersionRef TeamRef = new(Guid.NewGuid(), 1);

    private static readonly SectionDefinition Hero = Section(
        Heading("h", TextSlot("headline", "Welcome"), level: 1),
        Heading("sub", TextSlot("subtitle", ""), level: 3),
        ImageNode("i", ImageSlot("photo", alt: "Office", required: true)),
        Button("b", "ctaLabel", "ctaLink"));

    private static readonly SectionDefinition Team = Section(
        Heading("t", TextSlot("teamTitle", "Our team"), level: 2),
        Repeater("r", "people", 1, 4, Heading("n", TextSlot("name", "Name", required: true), level: 3), ImageNode("p", ImageSlot("portrait", alt: ""))));

    private static readonly Dictionary<string, SectionDefinition> Definitions = new()
    {
        [HeroRef.ToString()] = Hero,
        [TeamRef.ToString()] = Team,
    };

    private static IReadOnlyList<PublishIssue> Check(SiteDocument document) => PublishChecks.Run(document, Definitions);

    private static SiteDocument WithHero(IReadOnlyDictionary<string, SlotValue> values, params SectionInstance[] more) =>
        Site(Page("Home", "", [Instance(HeroRef, values: values), .. more]));

    private static readonly Dictionary<string, SlotValue> CompleteHero = Values(("photo", Image(Guid.NewGuid(), "Our office")));

    [Fact]
    public void A_complete_page_has_no_issues()
    {
        Check(WithHero(CompleteHero)).ShouldBeEmpty();
    }

    [Fact]
    public void Empty_required_slots_are_errors()
    {
        var issues = Check(WithHero(Values()));

        var issue = issues.ShouldHaveSingleItem();
        issue.Severity.ShouldBe(IssueSeverity.Error);
        issue.Code.ShouldBe(PublishIssueCodes.RequiredEmpty);
        issue.SlotKey.ShouldBe("photo");
        issue.InstanceId.ShouldNotBeNull();
    }

    [Fact]
    public void Images_without_alt_text_are_errors_including_the_logo()
    {
        var document = WithHero(Values(("photo", Image(Guid.NewGuid(), "  ")))) with
        {
            Settings = new SiteSettings { FirmName = "Firm", Logo = Image(Guid.NewGuid(), "") },
        };

        Check(document).Select(i => (i.Code, i.Path)).ShouldBe([
            (PublishIssueCodes.MissingAlt, "/settings/logo"),
            (PublishIssueCodes.MissingAlt, "/pages/0/sections/0/values/photo"),
        ]);
    }

    [Fact]
    public void Links_to_missing_pages_are_errors()
    {
        var issues = Check(WithHero(new Dictionary<string, SlotValue>(CompleteHero) { ["ctaLink"] = ToPage(Guid.NewGuid()) }));

        issues.ShouldHaveSingleItem().Code.ShouldBe(PublishIssueCodes.BrokenLink);
    }

    [Fact]
    public void Repeater_items_are_checked_one_by_one_including_default_items()
    {
        var team = Instance(TeamRef, repeaters: new Dictionary<string, IReadOnlyList<RepeaterItem>>
        {
            ["people"] = [Item(("name", Text("Ana"))), Item(("name", Text(" ")), ("portrait", Image(Guid.NewGuid(), "")))],
        });

        var issues = Check(WithHero(CompleteHero, team));

        issues.Select(i => i.Code).ShouldBe([PublishIssueCodes.RequiredEmpty, PublishIssueCodes.MissingAlt]);
        issues.ShouldAllBe(i => i.Path.StartsWith("/pages/0/sections/1/repeaters/", StringComparison.Ordinal));
    }

    [Fact]
    public void Hidden_sections_are_not_checked()
    {
        Check(WithHero(CompleteHero, Instance(HeroRef) with { Hidden = true })).ShouldBeEmpty();
    }

    [Fact]
    public void Heading_structure_problems_are_warnings()
    {
        var twoH1 = WithHero(CompleteHero, Instance(HeroRef, values: CompleteHero));
        Check(twoH1).ShouldContain(i => i.Code == PublishIssueCodes.HeadingOneCount && i.Severity == IssueSeverity.Warning);

        // h1 then h3 (the hero's subtitle) skips h2; empty headings are not rendered, so they do not count.
        var skipped = WithHero(new Dictionary<string, SlotValue>(CompleteHero) { ["subtitle"] = Text("Since 1998") });
        Check(skipped).ShouldHaveSingleItem().Code.ShouldBe(PublishIssueCodes.SkippedHeading);

        var noH1 = Site(Page("Home", "", Instance(TeamRef)));
        Check(noH1).ShouldContain(i => i.Code == PublishIssueCodes.HeadingOneCount && i.Message.Contains("no main heading", StringComparison.Ordinal));
    }

    [Fact]
    public void Low_theme_contrast_is_a_warning()
    {
        var document = WithHero(CompleteHero) with { Theme = Theme.Default with { Colors = Theme.Default.Colors with { Text = "#bbbbbb" } } };

        var issue = Check(document).ShouldHaveSingleItem();
        issue.Code.ShouldBe(PublishIssueCodes.Contrast);
        issue.Severity.ShouldBe(IssueSeverity.Warning);
    }
}

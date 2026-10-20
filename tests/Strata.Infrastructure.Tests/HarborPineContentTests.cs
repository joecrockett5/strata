using Strata.Domain.Content;
using Strata.Infrastructure.Content;
using Strata.Infrastructure.Seeding.Demo;

namespace Strata.Infrastructure.Tests;

/// <summary>The seed content must be valid content: what the section designer and editor could produce.</summary>
public sealed class HarborPineContentTests
{
    private static readonly HarborPine.Images Images = new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), [Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()]);
    private static readonly IReadOnlyList<HarborPine.SectionSpec> Sections = HarborPine.Sections(Images);
    private static readonly Dictionary<string, SectionVersionRef> Refs = Sections.ToDictionary(s => s.Key, _ => new SectionVersionRef(Guid.NewGuid(), 1));
    private readonly ContentSchemaValidator schema = new();

    [Fact]
    public void Covers_the_brief_s_section_types()
    {
        Sections.Select(s => s.Key).ShouldBe(["header", "hero", "services", "about", "team", "process", "faq", "cta", "contact", "footer"]);
    }

    [Fact]
    public void Definitions_and_template_pass_every_rule_and_publish_check()
    {
        HarborPine.Verify(Sections, Refs, HarborPine.TemplateDocument(Refs, Images), Images).ShouldBeEmpty();
    }

    [Fact]
    public void Definitions_and_template_match_the_json_schema()
    {
        foreach (var spec in Sections)
        {
            schema.Validate(ContentJson.ToElement(spec.Definition), ContentDocumentKind.SectionDefinition).ShouldBeEmpty(spec.Name);
        }

        schema.Validate(ContentJson.ToElement(HarborPine.TemplateDocument(Refs, Images)), ContentDocumentKind.SiteDocument).ShouldBeEmpty();
    }

    [Fact]
    public void Template_locks_what_the_brief_requires()
    {
        var document = HarborPine.TemplateDocument(Refs, Images);

        document.Pages.Select(p => p.Title).ShouldBe(["Home", "About", "Services", "Contact"]);
        document.Footer!.Lock.ShouldBe(SectionLock.Locked);
        document.Header!.Lock.ShouldBe(SectionLock.Required);
        document.Pages[3].Sections.ShouldContain(s => s.SectionTypeId == Refs["contact"].SectionTypeId && s.Lock == SectionLock.Required);
        document.ThemeLocks.ShouldBe([ThemeToken.Primary, ThemeToken.Secondary]);

        var footer = Sections.Single(s => s.Key == "footer").Definition;
        var disclosure = DefinitionWalker.Walk(footer).Select(w => w.Node).OfType<RichTextNode>().Single(n => n.Content.Key == "disclosure");
        disclosure.Content.Mode.ShouldBe(SlotMode.Locked);
    }
}

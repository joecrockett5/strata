using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using static Strata.Testing.Content;

namespace Strata.Domain.Tests;

/// <summary>A small catalogue of published sections used by the document and lock rule tests.</summary>
internal static class ValidationFixture
{
    public static readonly SectionVersionRef Hero = new(Guid.Parse("00000000-0000-7000-8000-000000000001"), 1);
    public static readonly SectionVersionRef HeroV2 = Hero with { Version = 2 };
    public static readonly SectionVersionRef Cards = new(Guid.Parse("00000000-0000-7000-8000-000000000002"), 1);
    public static readonly SectionVersionRef Retired = new(Guid.Parse("00000000-0000-7000-8000-000000000003"), 1);

    public static readonly Guid OwnMedia = Guid.Parse("00000000-0000-7000-8000-0000000000aa");

    public static readonly SectionDefinition HeroDefinition = Section(
        Heading("title", TextSlot("headline", "Welcome", maxLength: 20)),
        RichText("body", RichSlot("intro", maxLength: 10)),
        Heading("legal", TextSlot("disclaimer", "Regulated by X.", mode: SlotMode.Locked)),
        ImageNode("img", ImageSlot("photo")),
        Button("cta", "ctaLabel", "ctaLink"));

    public static readonly SectionDefinition CardsDefinition = Section(
        Repeater("cards", "cards", 1, 3,
            Heading("t", TextSlot("cardTitle")),
            Heading("fine", TextSlot("cardFinePrint", mode: SlotMode.Locked))));

    public static ContentValidationContext Context { get; } = new(
        new Dictionary<SectionVersionRef, PublishedSection>
        {
            [Hero] = new(Hero, "Hero", "Heroes", HeroDefinition, typeArchived: false),
            [HeroV2] = new(HeroV2, "Hero", "Heroes", HeroDefinition, typeArchived: false),
            [Cards] = new(Cards, "Cards", "Lists", CardsDefinition, typeArchived: false),
            [Retired] = new(Retired, "Retired", "Old", Section(), typeArchived: true),
        },
        new HashSet<Guid> { OwnMedia });
}

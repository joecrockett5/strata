using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using static Strata.Domain.Tests.ValidationFixture;
using static Strata.Testing.Content;

namespace Strata.Domain.Tests;

public sealed class SiteDocumentValidatorTests
{
    [Fact]
    public void A_valid_document_passes()
    {
        var document = Site(Page("Home", "", Instance(Hero, values: Values(("headline", Text("Hi")), ("photo", Image(OwnMedia, "A photo"))))));

        Validate(document).ShouldBeEmpty();
    }

    [Fact]
    public void Values_for_locked_slots_are_rejected()
    {
        var document = Site(Page("Home", "", Instance(Hero, values: Values(("disclaimer", Text("Not regulated"))))));

        var violation = Validate(document).ShouldHaveSingleItem();
        violation.Code.ShouldBe(ViolationCodes.SlotLocked);
        violation.Path.ShouldBe("/pages/0/sections/0/values/disclaimer");
    }

    [Fact]
    public void Values_for_locked_slots_inside_repeater_items_are_rejected()
    {
        var items = new Dictionary<string, IReadOnlyList<RepeaterItem>> { ["cards"] = [Item(("cardFinePrint", Text("x")))] };
        var document = Site(Page("Home", "", Instance(Cards, repeaters: items)));

        Validate(document).ShouldHaveSingleItem().Code.ShouldBe(ViolationCodes.SlotLocked);
    }

    [Theory]
    [InlineData("nope", ViolationCodes.UnknownSlot)]
    [InlineData("cardTitle", ViolationCodes.UnknownSlot)] // belongs to a repeater item, not the section
    public void Unknown_slot_keys_are_rejected(string key, string code)
    {
        var document = Site(Page("Home", "", Instance(Hero, values: Values((key, Text("x"))))));

        Validate(document).ShouldHaveSingleItem().Code.ShouldBe(code);
    }

    [Fact]
    public void Value_type_must_match_the_slot()
    {
        var document = Site(Page("Home", "", Instance(Hero, values: Values(("headline", Rich("<p>x</p>"))))));

        Validate(document).ShouldHaveSingleItem().Code.ShouldBe(ViolationCodes.SlotTypeMismatch);
    }

    [Fact]
    public void Max_length_applies_to_text_and_to_visible_rich_text()
    {
        var document = Site(Page("Home", "", Instance(Hero, values: Values(
            ("headline", Text(new string('x', 21))),
            ("intro", Rich("<p><strong>0123456789</strong></p>"))))));

        Validate(document).ShouldHaveSingleItem().Path.ShouldEndWith("/values/headline");
    }

    [Fact]
    public void Repeater_item_count_must_respect_min_and_max()
    {
        var tooMany = new Dictionary<string, IReadOnlyList<RepeaterItem>> { ["cards"] = [Item(), Item(), Item(), Item()] };
        var none = new Dictionary<string, IReadOnlyList<RepeaterItem>> { ["cards"] = [] };

        Validate(Site(Page("Home", "", Instance(Cards, repeaters: tooMany)))).ShouldHaveSingleItem().Code.ShouldBe(ViolationCodes.RepeaterItemCount);
        Validate(Site(Page("Home", "", Instance(Cards, repeaters: none)))).ShouldHaveSingleItem().Code.ShouldBe(ViolationCodes.RepeaterItemCount);
    }

    [Fact]
    public void Media_must_be_usable_by_the_author()
    {
        var document = Site(Page("Home", "", Instance(Hero, values: Values(("photo", Image(Guid.NewGuid(), "Someone else's"))))));

        Validate(document).ShouldHaveSingleItem().Code.ShouldBe(ViolationCodes.MediaNotFound);
    }

    [Fact]
    public void Unpublished_section_versions_are_rejected()
    {
        var document = Site(Page("Home", "", Instance(Hero with { Version = 9 })));

        Validate(document).ShouldHaveSingleItem().Code.ShouldBe(ViolationCodes.SectionVersionNotFound);
    }

    [Fact]
    public void Pages_need_unique_slugs_and_exactly_one_home()
    {
        Validate(Site(Page("A", "about"), Page("B", "about"))).Select(v => v.Code)
            .ShouldBe([ViolationCodes.DuplicateSlug, ViolationCodes.HomePage], ignoreOrder: true);
    }

    [Fact]
    public void Instance_ids_must_be_unique_across_the_site()
    {
        var instance = Instance(Hero);
        var document = Site(Page("Home", "", instance), Page("About", "about", instance));

        Validate(document).ShouldHaveSingleItem().Code.ShouldBe(ViolationCodes.DuplicateId);
    }

    private static IReadOnlyList<ContentViolation> Validate(SiteDocument document) => SiteDocumentValidator.Validate(document, Context);
}

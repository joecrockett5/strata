using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using static Strata.Testing.Content;

namespace Strata.Domain.Tests;

public sealed class SectionDefinitionRulesTests
{
    [Fact]
    public void A_well_formed_definition_has_no_issues()
    {
        var definition = Section(
            Heading("h", TextSlot("title")),
            Repeater("r", "items", 1, 3, Columns("c", [ImageNode("img", ImageSlot("photo"))], [RichText("t", RichSlot("bio"))])));

        SectionDefinitionRules.Validate(definition).ShouldBeEmpty();
    }

    [Fact]
    public void Slot_keys_must_be_unique_across_the_section_including_repeaters()
    {
        var definition = Section(Heading("a", TextSlot("title")), Repeater("r", "items", 1, 2, Heading("b", TextSlot("title"))));

        Codes(definition).ShouldBe([ViolationCodes.DuplicateSlotKey]);
    }

    [Fact]
    public void Repeater_keys_share_the_slot_key_namespace()
    {
        var definition = Section(Heading("a", TextSlot("items")), Repeater("r", "items", 1, 2));

        Codes(definition).ShouldBe([ViolationCodes.DuplicateSlotKey]);
    }

    [Fact]
    public void Repeater_min_must_not_exceed_max()
    {
        var definition = Section(Repeater("r", "items", 4, 2, Heading("h", TextSlot("t"))) with { DefaultItemCount = 2 });

        Codes(definition).ShouldBe([ViolationCodes.RepeaterBounds]);
    }

    [Fact]
    public void Default_item_count_must_be_within_bounds()
    {
        var definition = Section(Repeater("r", "items", 1, 3, Heading("h", TextSlot("t"))) with { DefaultItemCount = 5 });

        Codes(definition).ShouldBe([ViolationCodes.RepeaterBounds]);
    }

    [Fact]
    public void At_most_one_nav_per_section()
    {
        var definition = Section(new NavNode { Id = "n1" }, new NavNode { Id = "n2" });

        Codes(definition).ShouldBe([ViolationCodes.MultipleNav]);
    }

    [Fact]
    public void Image_slot_needs_default_alt_text_or_must_be_required()
    {
        Codes(Section(ImageNode("i", ImageSlot("photo", alt: "")))).ShouldBe([ViolationCodes.ImageAltMissing]);
        Codes(Section(ImageNode("i", ImageSlot("photo", alt: "", required: true)))).ShouldBeEmpty();
    }

    [Fact]
    public void Repeaters_cannot_be_nested()
    {
        var definition = Section(Repeater("outer", "outer", 1, 2, Repeater("inner", "inner", 1, 2)));

        Codes(definition).ShouldBe([ViolationCodes.NestedRepeater]);
    }

    [Fact]
    public void Node_ids_must_be_unique()
    {
        Codes(Section(Heading("same", TextSlot("a")), Heading("same", TextSlot("b")))).ShouldBe([ViolationCodes.DuplicateNodeId]);
    }

    [Fact]
    public void Column_ratio_must_match_column_count()
    {
        var columns = Columns("c", [Heading("h", TextSlot("a"))], [Heading("h2", TextSlot("b"))]) with { Ratio = ColumnRatio.Thirds };

        Codes(Section(columns)).ShouldBe([ViolationCodes.ColumnRatioMismatch]);
    }

    [Fact]
    public void Defaults_must_respect_max_length_and_cannot_link_to_pages()
    {
        var button = Button("b", "label", "link") with { Link = LinkSlot("link") with { Default = ToPage(Guid.NewGuid()) } };
        var definition = Section(Heading("h", TextSlot("title", "Far too long", maxLength: 3)), button);

        Codes(definition).ShouldBe([ViolationCodes.DefaultTooLong, ViolationCodes.DefaultPageLink], ignoreOrder: true);
    }

    [Fact]
    public void Violations_carry_a_path_to_the_offending_node()
    {
        var definition = Section(Heading("ok", TextSlot("a")), Repeater("r", "items", 1, 2, ImageNode("i", ImageSlot("photo", alt: ""))));

        SectionDefinitionRules.Validate(definition).ShouldHaveSingleItem().Path.ShouldBe("/root/children/1/children/0/image/default/alt");
    }

    private static List<string> Codes(SectionDefinition definition) => [.. SectionDefinitionRules.Validate(definition).Select(v => v.Code)];
}

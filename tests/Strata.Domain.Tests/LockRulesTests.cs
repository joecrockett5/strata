using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using static Strata.Domain.Tests.ValidationFixture;
using static Strata.Testing.Content;

namespace Strata.Domain.Tests;

public sealed class LockRulesTests
{
    private readonly SectionInstance locked = Instance(Hero, SectionLock.Locked);
    private readonly SectionInstance required = Instance(Hero, SectionLock.Required);
    private readonly SectionInstance free = Instance(Hero);
    private readonly SiteDocument stored;

    public LockRulesTests()
    {
        stored = Site(
            Page("Home", "", required, free, locked),
            Page("About", "about")) with
        {
            ThemeLocks = [ThemeToken.Primary, ThemeToken.Secondary],
            Footer = Instance(Hero, SectionLock.Locked),
        };
    }

    [Fact]
    public void Unchanged_document_passes()
    {
        Owner(stored).ShouldBeEmpty();
    }

    [Fact]
    public void Editing_free_and_required_sections_and_reordering_unlocked_ones_is_allowed()
    {
        var next = stored
            .ReplaceInstance(required.Id, s => s with { Values = Values(("headline", Text("New"))) })
            .ReplaceInstance(free.Id, s => s with { Hidden = true })
            .MapPage(0, p => p with { Sections = [free, required, Instance(Cards), locked] });

        Owner(next).ShouldBeEmpty();
    }

    [Fact]
    public void Locked_section_cannot_be_removed()
    {
        Codes(stored.MapPage(0, p => p with { Sections = [required, free] })).ShouldBe([ViolationCodes.LockedSectionRemoved]);
    }

    [Fact]
    public void Locked_global_footer_cannot_be_removed()
    {
        Codes(stored with { Footer = null }).ShouldBe([ViolationCodes.LockedSectionRemoved]);
    }

    [Fact]
    public void Locked_section_cannot_be_edited()
    {
        Codes(stored.ReplaceInstance(locked.Id, s => s with { Values = Values(("headline", Text("Edited"))) }))
            .ShouldBe([ViolationCodes.LockedSectionModified]);
    }

    [Fact]
    public void Locked_section_cannot_move_to_another_page()
    {
        var next = stored
            .MapPage(0, p => p with { Sections = [required, free] })
            .MapPage(1, p => p with { Sections = [locked] });

        Codes(next).ShouldContain(ViolationCodes.LockedSectionMoved);
    }

    [Fact]
    public void Locked_sections_keep_their_relative_order()
    {
        var second = Instance(Hero, SectionLock.Locked);
        var before = stored.MapPage(0, p => p with { Sections = [locked, free, second] });
        var after = stored.MapPage(0, p => p with { Sections = [second, free, locked] });

        LockRules.ValidateOwnerChanges(before, after).Select(v => v.Code).ShouldBe([ViolationCodes.LockedSectionMoved]);
    }

    [Fact]
    public void Required_section_cannot_be_removed_or_hidden()
    {
        Codes(stored.MapPage(0, p => p with { Sections = [free, locked] })).ShouldBe([ViolationCodes.RequiredSectionRemoved]);
        Codes(stored.ReplaceInstance(required.Id, s => s with { Hidden = true })).ShouldBe([ViolationCodes.LockedOrRequiredHidden]);
    }

    [Fact]
    public void Page_holding_a_required_section_cannot_be_deleted()
    {
        var next = stored with { Pages = [stored.Pages[1] with { Slug = "" }] };

        Codes(next).ShouldContain(ViolationCodes.RequiredSectionRemoved);
    }

    [Theory]
    [InlineData(SectionLock.None)]
    [InlineData(SectionLock.Required)]
    public void Owners_cannot_change_lock_flags(SectionLock newLock)
    {
        Codes(stored.ReplaceInstance(locked.Id, s => s with { Lock = newLock })).ShouldContain(ViolationCodes.SectionLockChanged);
    }

    [Fact]
    public void Owners_cannot_add_locked_sections()
    {
        Codes(stored.MapPage(1, p => p with { Sections = [Instance(Hero, SectionLock.Locked)] })).ShouldBe([ViolationCodes.SectionLockChanged]);
    }

    [Fact]
    public void Locked_theme_tokens_cannot_change_but_unlocked_ones_can()
    {
        var unlockedChange = stored with { Theme = stored.Theme with { Colors = stored.Theme.Colors with { Accent = "#000000" } } };
        var lockedChange = stored with { Theme = stored.Theme with { Colors = stored.Theme.Colors with { Primary = "#000000" } } };

        Owner(unlockedChange).ShouldBeEmpty();
        var violation = Owner(lockedChange).ShouldHaveSingleItem();
        violation.Code.ShouldBe(ViolationCodes.ThemeTokenLocked);
        violation.Path.ShouldBe("/theme/colors/primary");
    }

    [Fact]
    public void Theme_lock_list_cannot_change()
    {
        Codes(stored with { ThemeLocks = [ThemeToken.Primary] }).ShouldBe([ViolationCodes.ThemeLocksChanged]);
    }

    [Fact]
    public void Existing_instances_keep_their_pinned_version()
    {
        var next = stored.ReplaceInstance(free.Id, s => s with { Version = HeroV2.Version });

        LockRules.ValidateVersionPins(stored, next, Context).ShouldHaveSingleItem().Code.ShouldBe(ViolationCodes.VersionPinChanged);
    }

    [Fact]
    public void New_instances_cannot_use_archived_section_types_but_existing_ones_stay()
    {
        var withRetired = stored.MapPage(1, p => p with { Sections = [Instance(Retired)] });

        LockRules.ValidateVersionPins(stored, withRetired, Context).ShouldHaveSingleItem().Code.ShouldBe(ViolationCodes.SectionTypeArchived);
        LockRules.ValidateVersionPins(withRetired, withRetired, Context).ShouldBeEmpty();
    }

    private IReadOnlyList<ContentViolation> Owner(SiteDocument next) => LockRules.ValidateOwnerChanges(stored, next);

    private List<string> Codes(SiteDocument next) => [.. Owner(next).Select(v => v.Code)];
}

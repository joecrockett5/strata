using System.Net;
using Strata.Api.Tests.Infrastructure;
using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using static Strata.Testing.Content;

namespace Strata.Api.Tests.Locking;

/// <summary>
/// Attempts to bypass every locking rule by calling the API directly — the editor UI is not
/// involved. Each test starts from a fresh site created from the same locked-down template.
/// </summary>
public sealed class LockingRulesApiTests(PostgresFixture postgres) : ApiTestBase(postgres)
{
    private DesignerApi designer = null!;
    private OwnerApi owner = null!;
    private SectionVersionRef hero;
    private Guid templateId;

    public override async ValueTask InitializeAsync()
    {
        designer = await DesignerAsync();
        owner = await OwnerAsync();

        hero = await designer.PublishedSectionAsync("Hero", Section(
            Heading("title", TextSlot("headline", "Welcome")),
            Heading("legal", TextSlot("disclaimer", "Advisory services offered through Example Advisors, LLC.", mode: SlotMode.Locked))));

        var header = Instance(hero, SectionLock.Required);
        var footer = Instance(hero, SectionLock.Locked);
        var home = Page("Home", "",
            Instance(hero, SectionLock.Required, Values(("headline", Text("Home hero")))),
            Instance(hero),
            Instance(hero, SectionLock.Locked));
        var contact = Page("Contact", "contact", Instance(hero, SectionLock.Required));

        templateId = await designer.PublishedTemplateAsync(Site(home, contact) with
        {
            Header = header,
            Footer = footer,
            ThemeLocks = [ThemeToken.Primary, ThemeToken.Secondary],
        });
    }

    private Task<SiteResult> NewSiteAsync() => owner.CreateSiteAsync(templateId);

    private static SectionInstance Required(SiteResult site) => site.Document.Pages[0].Sections[0];

    private static SectionInstance Free(SiteResult site) => site.Document.Pages[0].Sections[1];

    private static SectionInstance Locked(SiteResult site) => site.Document.Pages[0].Sections[2];

    [Fact]
    public async Task Lock_flags_carry_into_sites_created_from_the_template()
    {
        var site = await NewSiteAsync();

        site.Document.Header!.Lock.ShouldBe(SectionLock.Required);
        site.Document.Footer!.Lock.ShouldBe(SectionLock.Locked);
        site.Document.Pages[0].Sections.Select(s => s.Lock).ShouldBe([SectionLock.Required, SectionLock.None, SectionLock.Locked]);
        site.Document.ThemeLocks.ShouldBe([ThemeToken.Primary, ThemeToken.Secondary]);
    }

    [Fact]
    public async Task Allowed_edits_succeed()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d
            .ReplaceInstance(Required(site).Id, s => s with { Values = Values(("headline", Text("Edited"))) })
            .ReplaceInstance(Free(site).Id, s => s with { Hidden = true })
            .MapPage(0, p => p with { Sections = [Free(site), Required(site), Instance(hero), Locked(site)] })
            with
        { Theme = d.Theme with { Colors = d.Theme.Colors with { Accent = "#123456" } } });

        await response.ShouldHaveStatusAsync(HttpStatusCode.OK);
    }

    // Rule 1: slot locks

    [Fact]
    public async Task Rule1_owner_cannot_set_a_locked_slot()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d.ReplaceInstance(Free(site).Id, s => s with { Values = Values(("disclaimer", Text("No disclosures."))) }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.SlotLocked);
    }

    [Fact]
    public async Task Rule1_designer_cannot_set_a_locked_slot_in_a_template_either()
    {
        var (id, revision) = await designer.CreateTemplateAsync("Sneaky");

        using var response = await designer.SaveTemplateAsync(id, revision, Site(Page("Home", "", Instance(hero, values: Values(("disclaimer", Text("Overridden")))))));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.SlotLocked);
    }

    // Rule 2: section locks

    [Fact]
    public async Task Rule2_locked_section_cannot_be_removed()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d.MapPage(0, p => p with { Sections = [Required(site), Free(site)] }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.LockedSectionRemoved);
    }

    [Fact]
    public async Task Rule2_locked_global_footer_cannot_be_removed()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d with { Footer = null });

        await response.ShouldBeRejectedWithAsync(ViolationCodes.LockedSectionRemoved);
    }

    [Fact]
    public async Task Rule2_locked_section_cannot_be_edited()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d.ReplaceInstance(Locked(site).Id, s => s with { Values = Values(("headline", Text("Edited"))) }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.LockedSectionModified);
    }

    [Fact]
    public async Task Rule2_locked_section_cannot_be_moved_to_another_page()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d
            .MapPage(0, p => p with { Sections = [Required(site), Free(site)] })
            .MapPage(1, p => p with { Sections = [.. p.Sections, Locked(site)] }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.LockedSectionMoved);
    }

    [Fact]
    public async Task Rule2_locked_section_cannot_be_hidden()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d.ReplaceInstance(Locked(site).Id, s => s with { Hidden = true }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.LockedOrRequiredHidden);
    }

    [Fact]
    public async Task Rule2_required_section_cannot_be_removed()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d.MapPage(0, p => p with { Sections = [Free(site), Locked(site)] }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.RequiredSectionRemoved);
    }

    [Fact]
    public async Task Rule2_required_global_header_cannot_be_removed()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d with { Header = null });

        await response.ShouldBeRejectedWithAsync(ViolationCodes.RequiredSectionRemoved);
    }

    [Fact]
    public async Task Rule2_page_with_a_required_section_cannot_be_deleted()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d with { Pages = [d.Pages[0]] });

        await response.ShouldBeRejectedWithAsync(ViolationCodes.RequiredSectionRemoved);
    }

    [Fact]
    public async Task Rule2_owner_cannot_unlock_a_section()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d.ReplaceInstance(Locked(site).Id, s => s with { Lock = SectionLock.None }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.SectionLockChanged);
    }

    [Fact]
    public async Task Rule2_owner_cannot_add_a_section_with_lock_flags()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d.MapPage(1, p => p with { Sections = [.. p.Sections, Instance(hero, SectionLock.Required)] }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.SectionLockChanged);
    }

    // Rule 3: theme token locks

    [Fact]
    public async Task Rule3_locked_theme_token_cannot_change()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d with { Theme = d.Theme with { Colors = d.Theme.Colors with { Secondary = "#ff00ff" } } });

        var violation = (await response.ShouldBeRejectedAsync()).ShouldHaveSingleItem();
        violation.Code.ShouldBe(ViolationCodes.ThemeTokenLocked);
        violation.Path.ShouldBe("/theme/colors/secondary");
    }

    [Fact]
    public async Task Rule3_owner_cannot_remove_theme_locks()
    {
        var site = await NewSiteAsync();

        using var response = await owner.SaveAsync(site, d => d with { ThemeLocks = [] });

        await response.ShouldBeRejectedWithAsync(ViolationCodes.ThemeLocksChanged);
    }

    // Rule 4: versions

    [Fact]
    public async Task Rule4_existing_instances_cannot_be_repinned()
    {
        var site = await NewSiteAsync();
        using (var save = await designer.SaveSectionTypeAsync(hero.SectionTypeId, (await designer.GetSectionTypeAsync(hero.SectionTypeId)).Revision, Section(Heading("title", TextSlot("headline")))))
        {
            await save.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        var v2 = await designer.PublishSectionTypeAsync(hero.SectionTypeId);

        using var response = await owner.SaveAsync(site, d => d.ReplaceInstance(Free(site).Id, s => s with { Version = v2.Version }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.VersionPinChanged);
    }

    [Fact]
    public async Task Rule4_new_instances_must_use_a_published_version()
    {
        var site = await NewSiteAsync();
        var draftOnly = await designer.CreateSectionTypeAsync("Unpublished", Section());

        using var response = await owner.SaveAsync(site, d => d.MapPage(1, p => p with { Sections = [Instance(new SectionVersionRef(draftOnly.Id, 1))] }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.SectionVersionNotFound);
    }

    [Fact]
    public async Task Rule4_archived_types_cannot_be_added_but_existing_uses_survive()
    {
        var retired = await designer.PublishedSectionAsync("Retired", Section(Heading("t", TextSlot("t"))));
        var site = await NewSiteAsync();
        using (var add = await owner.SaveAsync(site, d => d.MapPage(1, p => p with { Sections = [.. p.Sections, Instance(retired)] })))
        {
            await add.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        (await designer.Http.PostAsync(new Uri($"/api/section-types/{retired.SectionTypeId}/archive", UriKind.Relative), null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var current = await owner.GetSiteAsync(site.Id);
        using (var keep = await owner.SaveAsync(current, d => d with { Settings = d.Settings with { FirmName = "Still fine" } }))
        {
            await keep.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        current = await owner.GetSiteAsync(site.Id);
        using var addAgain = await owner.SaveAsync(current, d => d.MapPage(1, p => p with { Sections = [.. p.Sections, Instance(retired)] }));
        await addAgain.ShouldBeRejectedWithAsync(ViolationCodes.SectionTypeArchived);
    }
}

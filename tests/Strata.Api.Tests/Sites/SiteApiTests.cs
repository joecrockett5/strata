using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Strata.Api.Tests.Infrastructure;
using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using static Strata.Testing.Content;

namespace Strata.Api.Tests.Sites;

public sealed class SiteApiTests(PostgresFixture postgres) : ApiTestBase(postgres)
{
    [Fact]
    public async Task Owner_creates_a_blank_site()
    {
        var owner = await OwnerAsync();

        var site = await owner.CreateSiteAsync();

        site.Revision.ShouldBe(1);
        site.SourceTemplateId.ShouldBeNull();
        site.Document.Pages.ShouldHaveSingleItem().IsHome.ShouldBeTrue();
        site.Document.Settings.FirmName.ShouldBe("My site");
    }

    [Fact]
    public async Task Site_from_a_template_is_an_independent_copy_pinned_to_its_versions()
    {
        var designer = await DesignerAsync();
        var hero = await designer.CreateSectionTypeAsync("Hero", Section(Heading("h", TextSlot("headline", "Version one"))));
        var heroV1 = await designer.PublishSectionTypeAsync(hero.Id);
        var templateDoc = Site(Page("Home", "", Instance(heroV1)), Page("About", "about"));
        var templateId = await designer.PublishedTemplateAsync(templateDoc);

        var owner = await OwnerAsync();
        var site = await owner.CreateSiteAsync(templateId);

        site.SourceTemplateId.ShouldBe(templateId);
        site.SourceTemplateVersion.ShouldBe(1);
        site.Document.Pages.Count.ShouldBe(2);

        // The designer publishes a new section version and a new template version...
        using (var save = await designer.SaveSectionTypeAsync(hero.Id, hero.Revision, Section(Heading("h", TextSlot("headline", "Version two")))))
        {
            await save.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        await designer.PublishSectionTypeAsync(hero.Id);
        await designer.PublishTemplateAsync(templateId);

        // ...and the existing site is untouched: same pinned version, same definition.
        var reloaded = await owner.GetSiteAsync(site.Id);
        reloaded.Document.Pages[0].Sections.ShouldHaveSingleItem().Version.ShouldBe(1);
        var definition = reloaded.Sections.ShouldHaveSingleItem();
        definition.Version.ShouldBe(1);
        ((HeadingNode)definition.Definition.Root.Children[0]).Text.Default.Text.ShouldBe("Version one");
        reloaded.SourceTemplateVersion.ShouldBe(1);
    }

    [Fact]
    public async Task Draft_saves_use_optimistic_concurrency()
    {
        var owner = await OwnerAsync();
        var site = await owner.CreateSiteAsync();
        var renamed = site.Document with { Settings = site.Document.Settings with { FirmName = "Renamed" } };

        using (var missing = await owner.SaveDraftJsonAsync(site.Id, null, ApiJson.Json(new { document = renamed })))
        {
            await missing.ShouldHaveStatusAsync(HttpStatusCode.PreconditionRequired);
        }

        using (var ok = await owner.SaveDraftAsync(site.Id, site.Revision, renamed))
        {
            await ok.ShouldHaveStatusAsync(HttpStatusCode.OK);
            ok.Headers.ETag!.Tag.ShouldBe("\"r2\"");
        }

        using var stale = await owner.SaveDraftAsync(site.Id, site.Revision, renamed);
        await stale.ShouldHaveStatusAsync(HttpStatusCode.Conflict);
        (await owner.GetSiteAsync(site.Id)).Document.Settings.FirmName.ShouldBe("Renamed");
    }

    [Fact]
    public async Task Rich_text_is_sanitised_on_write()
    {
        var designer = await DesignerAsync();
        var text = await designer.PublishedSectionAsync("Text", Section(RichText("t", RichSlot("body"))));
        var owner = await OwnerAsync();
        var site = await owner.CreateSiteAsync();

        var malicious = Rich("<p onclick=\"steal()\">Hi <a href=\"javascript:alert(1)\">there</a><script>alert(2)</script></p>");
        using var save = await owner.SaveAsync(site, d => d.MapPage(0, p => p with { Sections = [Instance(text, values: Values(("body", malicious)))] }));
        await save.ShouldHaveStatusAsync(HttpStatusCode.OK);

        var stored = (await owner.GetSiteAsync(site.Id)).Document.Pages[0].Sections[0].Values["body"];
        stored.ShouldBe(Rich("<p>Hi <a>there</a></p>"));
    }

    [Fact]
    public async Task Schema_invalid_documents_are_rejected()
    {
        var owner = await OwnerAsync();
        var site = await owner.CreateSiteAsync();
        var body = """{ "document": { "schemaVersion": 1, "settings": { "firmName": "", "logo": null }, "theme": {}, "themeLocks": [], "header": null, "footer": null, "pages": [] } }""";

        using var response = await owner.SaveDraftJsonAsync(site.Id, site.Revision, new StringContent(body, Encoding.UTF8, "application/json"));

        var violations = await response.ShouldBeRejectedAsync();
        violations.ShouldAllBe(v => v.Code == ViolationCodes.SchemaInvalid);
        violations.Select(v => v.Path).ShouldContain("/settings/firmName");
        violations.Select(v => v.Path).ShouldContain("/pages");
    }

    [Fact]
    public async Task Site_slugs_are_validated_and_unique()
    {
        var owner = await OwnerAsync();
        var slug = OwnerApi.UniqueSlug();

        (await owner.TryCreateSiteAsync(slug)).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await owner.TryCreateSiteAsync(slug)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await owner.TryCreateSiteAsync("Not A Slug!")).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await owner.TryCreateSiteAsync("api")).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Owner_can_rename_and_delete_their_site()
    {
        var owner = await OwnerAsync();
        var site = await owner.CreateSiteAsync();
        var newSlug = OwnerApi.UniqueSlug();

        using (var patch = await owner.Http.PatchAsJsonAsync($"/api/sites/{site.Id}", new { name = "New name", slug = newSlug }, TestContext.Current.CancellationToken))
        {
            await patch.ShouldHaveStatusAsync(HttpStatusCode.OK);
            (await patch.ReadJsonAsync()).GetProperty("slug").GetString().ShouldBe(newSlug);
        }

        (await owner.Http.DeleteAsync(new Uri($"/api/sites/{site.Id}", UriKind.Relative), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await owner.Http.GetAsync(new Uri($"/api/sites/{site.Id}", UriKind.Relative), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Owners_only_see_and_touch_their_own_sites()
    {
        var owner = await OwnerAsync();
        var site = await owner.CreateSiteAsync();
        var other = await OwnerAsync(StrataApiFactory.OtherOwner);
        var ct = TestContext.Current.CancellationToken;

        var list = await other.Http.GetFromJsonAsync<JsonElement[]>("/api/sites", ct);
        list!.ShouldNotContain(s => s.GetProperty("id").GetGuid() == site.Id);

        (await other.Http.GetAsync(new Uri($"/api/sites/{site.Id}", UriKind.Relative), ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.SaveDraftAsync(site.Id, site.Revision, site.Document)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.Http.PatchAsJsonAsync($"/api/sites/{site.Id}", new { name = "Hijacked", slug = OwnerApi.UniqueSlug() }, ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.Http.DeleteAsync(new Uri($"/api/sites/{site.Id}", UriKind.Relative), ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var unchanged = await owner.GetSiteAsync(site.Id);
        unchanged.Revision.ShouldBe(site.Revision);
    }

    [Fact]
    public async Task Designers_cannot_use_site_endpoints()
    {
        var designer = await DesignerAsync();

        using var response = await designer.Http.GetAsync(new Uri("/api/sites", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Unsafe_requests_without_the_antiforgery_header_are_rejected()
    {
        var handler = new BrowserLikeHandler();
        using var http = Factory.CreateDefaultClient(handler);
        var client = new StrataClient(http);
        await client.LoginAsAsync(StrataApiFactory.Owner);
        handler.SendAntiforgeryHeader = false;

        using var response = await http.PostAsJsonAsync("/api/sites", new { name = "x", slug = OwnerApi.UniqueSlug() }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}

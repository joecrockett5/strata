using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Strata.Api.Tests.Infrastructure;
using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using static Strata.Testing.Content;

namespace Strata.Api.Tests.Templates;

public sealed class TemplateApiTests(PostgresFixture postgres) : ApiTestBase(postgres)
{
    [Fact]
    public async Task Designer_builds_versions_and_publishes_a_template()
    {
        var designer = await DesignerAsync();
        var hero = await designer.PublishedSectionAsync("Hero", Section(Heading("h", TextSlot("headline"))));
        var (id, revision) = await designer.CreateTemplateAsync("Advisor");

        var document = Site(Page("Home", "", Instance(hero, SectionLock.Required, Values(("headline", Text("Welcome"))))));
        using (var save = await designer.SaveTemplateAsync(id, revision, document))
        {
            await save.ShouldHaveStatusAsync(HttpStatusCode.OK);
            var saved = await save.ReadJsonAsync();
            saved.GetProperty("revision").GetInt64().ShouldBe(revision + 1);
            saved.GetProperty("sections").GetArrayLength().ShouldBe(1);
        }

        await designer.PublishTemplateAsync(id);
        await designer.PublishTemplateAsync(id);

        var owner = await OwnerAsync();
        var published = await owner.Http.GetFromJsonAsync<JsonElement[]>("/api/templates/published", TestContext.Current.CancellationToken);
        var entry = published!.Single(t => t.GetProperty("id").GetGuid() == id);
        entry.GetProperty("version").GetInt32().ShouldBe(2);
        entry.GetProperty("pageCount").GetInt32().ShouldBe(1);
    }

    [Fact]
    public async Task Template_cannot_use_unpublished_section_versions()
    {
        var designer = await DesignerAsync();
        var draftOnly = await designer.CreateSectionTypeAsync("Draft", Section());
        var (id, revision) = await designer.CreateTemplateAsync("T");

        using var save = await designer.SaveTemplateAsync(id, revision, Site(Page("Home", "", Instance(new SectionVersionRef(draftOnly.Id, 1)))));

        await save.ShouldBeRejectedWithAsync(ViolationCodes.SectionVersionNotFound);
    }

    [Fact]
    public async Task Template_from_a_theme_preset_starts_with_its_theme()
    {
        var designer = await DesignerAsync();
        var theme = Theme.Default with { Radius = ThemeRadius.Large };
        using var preset = await designer.Http.PostAsync(new Uri("/api/theme-presets", UriKind.Relative), ApiJson.Json(new { name = $"Preset {Guid.NewGuid():N}", theme }), TestContext.Current.CancellationToken);
        await preset.ShouldHaveStatusAsync(HttpStatusCode.Created);
        var presetId = (await preset.ReadJsonAsync()).GetProperty("id").GetGuid();

        using var created = await designer.Http.PostAsJsonAsync("/api/templates", new { name = "Themed", themePresetId = presetId }, TestContext.Current.CancellationToken);

        await created.ShouldHaveStatusAsync(HttpStatusCode.Created);
        var document = ContentJson.Deserialize<SiteDocument>((await created.ReadJsonAsync()).GetProperty("document"));
        document.Theme.Radius.ShouldBe(ThemeRadius.Large);
    }

    [Fact]
    public async Task Theme_presets_are_validated_against_the_schema()
    {
        var designer = await DesignerAsync();
        var badTheme = new { colors = new { primary = "blue" }, fonts = new { heading = "comic-sans", body = "system-ui" }, radius = "small" };

        using var response = await designer.Http.PostAsJsonAsync("/api/theme-presets", new { name = "Bad", theme = badTheme }, TestContext.Current.CancellationToken);

        await response.ShouldBeRejectedWithAsync(ViolationCodes.SchemaInvalid);
    }

    [Fact]
    public async Task Seeded_theme_presets_are_listed_for_designers_and_owners()
    {
        foreach (var http in new[] { (await DesignerAsync()).Http, (await OwnerAsync()).Http })
        {
            var presets = await http.GetFromJsonAsync<JsonElement[]>("/api/theme-presets", TestContext.Current.CancellationToken);

            var names = presets!.Select(p => p.GetProperty("name").GetString()).ToList();
            names.ShouldContain("Strata default");
            names.ShouldContain("Coastal");
            names.ShouldContain("Ink");
            var seededDefault = presets!.Single(p => p.GetProperty("name").GetString() == "Strata default");
            ContentJson.Deserialize<Theme>(seededDefault.GetProperty("theme")).ShouldBe(Theme.Default);
        }
    }

    [Fact]
    public async Task Template_without_a_description_can_be_saved()
    {
        var designer = await DesignerAsync();
        var (id, revision) = await designer.CreateTemplateAsync("No description");
        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/templates/{id}")
        {
            Content = ApiJson.Json(new { name = "No description", description = "", thumbnailMediaId = (Guid?)null, document = Site(Page("Home", "")) }),
        };
        request.Headers.TryAddWithoutValidation("If-Match", $"\"r{revision}\"");

        using var response = await designer.Http.SendAsync(request, TestContext.Current.CancellationToken);

        await response.ShouldHaveStatusAsync(HttpStatusCode.OK);
        (await response.ReadJsonAsync()).GetProperty("description").GetString().ShouldBe(string.Empty);
    }
}

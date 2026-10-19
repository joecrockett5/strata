using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Strata.Api.Tests.Infrastructure;
using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using static Strata.Testing.Content;

namespace Strata.Api.Tests.SectionTypes;

public sealed class SectionTypeApiTests(PostgresFixture postgres) : ApiTestBase(postgres)
{
    private static readonly SectionDefinition Hero = Section(Heading("h", TextSlot("headline", "Hello")));

    [Fact]
    public async Task Designer_creates_reads_and_updates_a_draft()
    {
        var designer = await DesignerAsync();
        var created = await designer.CreateSectionTypeAsync("Hero", Hero);

        created.Revision.ShouldBe(1);
        created.LatestVersion.ShouldBe(0);
        ContentJson.StructurallyEqual(created.Draft, Hero).ShouldBeTrue();

        var changed = Section(Heading("h", TextSlot("headline", "Changed")));
        using var save = await designer.SaveSectionTypeAsync(created.Id, created.Revision, changed);
        await save.ShouldHaveStatusAsync(HttpStatusCode.OK);
        save.Headers.ETag?.Tag.ShouldBe("\"r2\"");

        var reloaded = await designer.GetSectionTypeAsync(created.Id);
        reloaded.Revision.ShouldBe(2);
        ContentJson.StructurallyEqual(reloaded.Draft, changed).ShouldBeTrue();
    }

    [Fact]
    public async Task New_section_type_without_a_definition_starts_empty()
    {
        var designer = await DesignerAsync();
        using var response = await designer.Http.PostAsJsonAsync("/api/section-types", new { name = "Blank", category = "Misc" }, TestContext.Current.CancellationToken);

        await response.ShouldHaveStatusAsync(HttpStatusCode.Created);
        var draft = ContentJson.Deserialize<SectionDefinition>((await response.ReadJsonAsync()).GetProperty("draft"));
        draft.Root.Children.ShouldBeEmpty();
    }

    [Fact]
    public async Task Draft_save_requires_if_match_and_rejects_stale_revisions()
    {
        var designer = await DesignerAsync();
        var created = await designer.CreateSectionTypeAsync("Hero", Hero);

        var missing = new HttpRequestMessage(HttpMethod.Put, $"/api/section-types/{created.Id}") { Content = ApiJson.Json(new { name = "x", category = "y", definition = Hero }) };
        using (var response = await designer.Http.SendAsync(missing, TestContext.Current.CancellationToken))
        {
            await response.ShouldHaveStatusAsync(HttpStatusCode.PreconditionRequired);
        }

        using (var first = await designer.SaveSectionTypeAsync(created.Id, 1, Hero))
        {
            await first.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        using var stale = await designer.SaveSectionTypeAsync(created.Id, 1, Hero);
        await stale.ShouldHaveStatusAsync(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Schema_invalid_definitions_are_rejected_with_a_path()
    {
        var designer = await DesignerAsync();
        var created = await designer.CreateSectionTypeAsync("Hero", Hero);
        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/section-types/{created.Id}")
        {
            Content = new StringContent(
                """{ "name": "x", "category": "y", "definition": { "schemaVersion": 1, "root": { "$type": "section", "id": "root", "background": "neon", "paddingY": "lg", "width": "standard", "children": [] } } }""",
                System.Text.Encoding.UTF8,
                "application/json"),
        };
        request.Headers.TryAddWithoutValidation("If-Match", "\"r1\"");

        using var response = await designer.Http.SendAsync(request, TestContext.Current.CancellationToken);

        var violation = (await response.ShouldBeRejectedAsync()).ShouldHaveSingleItem();
        violation.Code.ShouldBe(ViolationCodes.SchemaInvalid);
        violation.Path.ShouldBe("/root/background");
    }

    [Fact]
    public async Task Publishing_freezes_numbered_immutable_versions()
    {
        var designer = await DesignerAsync();
        var created = await designer.CreateSectionTypeAsync("Hero", Hero);

        var v1 = await designer.PublishSectionTypeAsync(created.Id);
        v1.Version.ShouldBe(1);
        (await designer.GetSectionTypeAsync(created.Id)).HasUnpublishedChanges.ShouldBeFalse();

        var changed = Section(Heading("h", TextSlot("headline", "Version two")));
        using (var save = await designer.SaveSectionTypeAsync(created.Id, created.Revision, changed))
        {
            await save.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        (await designer.GetSectionTypeAsync(created.Id)).HasUnpublishedChanges.ShouldBeTrue();
        var v2 = await designer.PublishSectionTypeAsync(created.Id);
        v2.Version.ShouldBe(2);

        var stored = await designer.Http.GetFromJsonAsync<JsonElement>($"/api/section-types/{created.Id}/versions/1", TestContext.Current.CancellationToken);
        var v1Definition = ContentJson.Deserialize<SectionDefinition>(stored.GetProperty("definition"));
        ContentJson.StructurallyEqual(v1Definition, Hero).ShouldBeTrue("version 1 must not change when version 2 is published");
    }

    [Fact]
    public async Task Publishing_runs_the_definition_rules()
    {
        var designer = await DesignerAsync();
        var invalid = Section(
            Heading("a", TextSlot("same")),
            Heading("b", TextSlot("same")),
            new NavNode { Id = "n1" },
            new NavNode { Id = "n2" },
            ImageNode("i", ImageSlot("photo", alt: "")),
            Repeater("r", "items", 3, 1) with { DefaultItemCount = 1 });
        var created = await designer.CreateSectionTypeAsync("Broken", invalid);

        created.PublishIssueCodes.ShouldNotBeEmpty("drafts may be saved while invalid, with issues reported");
        using var response = await designer.TryPublishSectionTypeAsync(created.Id);

        var codes = (await response.ShouldBeRejectedAsync()).Select(v => v.Code).ToList();
        codes.ShouldBe(
            [ViolationCodes.DuplicateSlotKey, ViolationCodes.MultipleNav, ViolationCodes.ImageAltMissing, ViolationCodes.RepeaterBounds],
            ignoreOrder: true);
        (await designer.GetSectionTypeAsync(created.Id)).LatestVersion.ShouldBe(0);
    }

    [Fact]
    public async Task Library_lists_latest_published_versions_and_hides_archived_and_unpublished_types()
    {
        var designer = await DesignerAsync();
        var published = await designer.CreateSectionTypeAsync($"Lib {Guid.NewGuid():N}", Hero);
        await designer.PublishSectionTypeAsync(published.Id);
        using (var save = await designer.SaveSectionTypeAsync(published.Id, published.Revision, Hero))
        {
            await save.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        await designer.PublishSectionTypeAsync(published.Id);
        var draftOnly = await designer.CreateSectionTypeAsync("Draft only", Hero);
        var archived = await designer.CreateSectionTypeAsync("Archived", Hero);
        await designer.PublishSectionTypeAsync(archived.Id);
        (await designer.Http.PostAsync(new Uri($"/api/section-types/{archived.Id}/archive", UriKind.Relative), null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var owner = await OwnerAsync();
        var library = await owner.Http.GetFromJsonAsync<JsonElement[]>("/api/library", TestContext.Current.CancellationToken);

        library!.Where(e => e.GetProperty("sectionTypeId").GetGuid() == published.Id).ShouldHaveSingleItem().GetProperty("version").GetInt32().ShouldBe(2);
        library!.ShouldNotContain(e => e.GetProperty("sectionTypeId").GetGuid() == draftOnly.Id);
        library!.ShouldNotContain(e => e.GetProperty("sectionTypeId").GetGuid() == archived.Id);
    }

    [Fact]
    public async Task Archived_types_can_be_restored_and_duplicated()
    {
        var designer = await DesignerAsync();
        var created = await designer.CreateSectionTypeAsync("Original", Hero);
        (await designer.Http.PostAsync(new Uri($"/api/section-types/{created.Id}/archive", UriKind.Relative), null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using (var publish = await designer.TryPublishSectionTypeAsync(created.Id))
        {
            await publish.ShouldHaveStatusAsync(HttpStatusCode.Conflict);
        }

        (await designer.Http.PostAsync(new Uri($"/api/section-types/{created.Id}/restore", UriKind.Relative), null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var duplicate = await designer.Http.PostAsJsonAsync($"/api/section-types/{created.Id}/duplicate", new { name = (string?)null }, TestContext.Current.CancellationToken);
        await duplicate.ShouldHaveStatusAsync(HttpStatusCode.Created);
        var copy = await duplicate.ReadJsonAsync();
        copy.GetProperty("name").GetString().ShouldBe("Original (copy)");
        copy.GetProperty("latestVersion").GetInt32().ShouldBe(0);
    }

    [Theory]
    [InlineData("GET", "/api/section-types")]
    [InlineData("POST", "/api/section-types")]
    [InlineData("POST", "/api/templates")]
    [InlineData("GET", "/api/templates")]
    public async Task Site_owners_cannot_use_designer_endpoints(string method, string path)
    {
        var owner = await OwnerAsync();
        using var request = new HttpRequestMessage(new HttpMethod(method), path) { Content = method == "GET" ? null : JsonContent.Create(new { name = "x", category = "y" }) };

        using var response = await owner.Http.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Anonymous_users_get_401()
    {
        using var client = AnonymousClient();

        using var response = await client.Http.GetAsync(new Uri("/api/library", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}

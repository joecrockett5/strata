using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Strata.Domain.Content;

namespace Strata.Api.Tests.Infrastructure;

/// <summary>Designer-side workflows: section types, templates and theme presets.</summary>
public sealed class DesignerApi(StrataClient client)
{
    public HttpClient Http => client.Http;

    public async Task<SectionTypeResult> CreateSectionTypeAsync(string name, SectionDefinition definition, string category = "Test")
    {
        using var response = await Http.PostAsync(new Uri("/api/section-types", UriKind.Relative), ApiJson.Json(new { name, category, definition }));
        await response.ShouldHaveStatusAsync(HttpStatusCode.Created);
        return ReadSectionType(await response.ReadJsonAsync());
    }

    public async Task<SectionTypeResult> GetSectionTypeAsync(Guid id) =>
        ReadSectionType(await Http.GetFromJsonAsync<JsonElement>($"/api/section-types/{id}"));

    public Task<HttpResponseMessage> SaveSectionTypeAsync(Guid id, long revision, SectionDefinition definition, string name = "Renamed", string category = "Test")
    {
        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/section-types/{id}") { Content = ApiJson.Json(new { name, category, definition }) };
        request.Headers.TryAddWithoutValidation("If-Match", $"\"r{revision}\"");
        return Http.SendAsync(request);
    }

    public Task<HttpResponseMessage> TryPublishSectionTypeAsync(Guid id) =>
        Http.PostAsync(new Uri($"/api/section-types/{id}/versions", UriKind.Relative), null);

    public async Task<SectionVersionRef> PublishSectionTypeAsync(Guid id)
    {
        using var response = await TryPublishSectionTypeAsync(id);
        await response.ShouldHaveStatusAsync(HttpStatusCode.Created);
        var json = await response.ReadJsonAsync();
        return new SectionVersionRef(id, json.GetProperty("version").GetInt32());
    }

    /// <summary>Creates and publishes a section type in one go.</summary>
    public async Task<SectionVersionRef> PublishedSectionAsync(string name, SectionDefinition definition)
    {
        var created = await CreateSectionTypeAsync(name, definition);
        return await PublishSectionTypeAsync(created.Id);
    }

    public async Task<(Guid Id, long Revision)> CreateTemplateAsync(string name)
    {
        using var response = await Http.PostAsJsonAsync("/api/templates", new { name, description = "Test template" });
        await response.ShouldHaveStatusAsync(HttpStatusCode.Created);
        var json = await response.ReadJsonAsync();
        return (json.GetProperty("id").GetGuid(), json.GetProperty("revision").GetInt64());
    }

    public Task<HttpResponseMessage> SaveTemplateAsync(Guid id, long revision, SiteDocument document)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/templates/{id}")
        {
            Content = ApiJson.Json(new { name = "Template", description = "Test template", thumbnailMediaId = (Guid?)null, document }),
        };
        request.Headers.TryAddWithoutValidation("If-Match", $"\"r{revision}\"");
        return Http.SendAsync(request);
    }

    public async Task PublishTemplateAsync(Guid id)
    {
        using var response = await Http.PostAsync(new Uri($"/api/templates/{id}/versions", UriKind.Relative), null);
        await response.ShouldHaveStatusAsync(HttpStatusCode.Created);
    }

    /// <summary>Creates a template whose draft is <paramref name="document"/> and publishes it.</summary>
    public async Task<Guid> PublishedTemplateAsync(SiteDocument document)
    {
        var (id, revision) = await CreateTemplateAsync($"Template {Guid.NewGuid():N}");
        using (var save = await SaveTemplateAsync(id, revision, document))
        {
            await save.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        await PublishTemplateAsync(id);
        return id;
    }

    private static SectionTypeResult ReadSectionType(JsonElement json) => new(
        json.GetProperty("id").GetGuid(),
        json.GetProperty("revision").GetInt64(),
        json.GetProperty("latestVersion").GetInt32(),
        json.GetProperty("hasUnpublishedChanges").GetBoolean(),
        ContentJson.Deserialize<SectionDefinition>(json.GetProperty("draft")),
        [.. json.GetProperty("publishIssues").EnumerateArray().Select(i => i.GetProperty("code").GetString()!)]);
}

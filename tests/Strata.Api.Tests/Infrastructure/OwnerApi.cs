using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Strata.Domain.Content;

namespace Strata.Api.Tests.Infrastructure;

/// <summary>Site-owner workflows: sites, drafts and media.</summary>
public sealed class OwnerApi(StrataClient client)
{
    public HttpClient Http => client.Http;

    public static string UniqueSlug() => $"site-{Guid.NewGuid():N}"[..20];

    public Task<HttpResponseMessage> TryCreateSiteAsync(string slug, Guid? templateId = null, string name = "My site") =>
        Http.PostAsJsonAsync("/api/sites", new { name, slug, templateId });

    public async Task<SiteResult> CreateSiteAsync(Guid? templateId = null)
    {
        using var response = await TryCreateSiteAsync(UniqueSlug(), templateId);
        await response.ShouldHaveStatusAsync(HttpStatusCode.Created);
        return ReadSite(await response.ReadJsonAsync());
    }

    public async Task<SiteResult> GetSiteAsync(Guid id) => ReadSite(await Http.GetFromJsonAsync<JsonElement>($"/api/sites/{id}"));

    public Task<HttpResponseMessage> SaveDraftAsync(Guid id, long revision, SiteDocument document) =>
        SaveDraftJsonAsync(id, revision, ApiJson.Json(new { document }));

    public Task<HttpResponseMessage> SaveDraftJsonAsync(Guid id, long? revision, HttpContent content)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/sites/{id}/draft") { Content = content };
        if (revision is { } r)
        {
            request.Headers.TryAddWithoutValidation("If-Match", $"\"r{r}\"");
        }

        return Http.SendAsync(request);
    }

    /// <summary>Saves a modified draft of <paramref name="site"/>.</summary>
    public Task<HttpResponseMessage> SaveAsync(SiteResult site, Func<SiteDocument, SiteDocument> change) =>
        SaveDraftAsync(site.Id, site.Revision, change(site.Document));

    public async Task<Guid> UploadPngAsync(int width = 8, int height = 8)
    {
        using var response = await UploadAsync(TestImages.Png(width, height), "photo.png", "image/png");
        await response.ShouldHaveStatusAsync(HttpStatusCode.Created);
        return (await response.ReadJsonAsync()).GetProperty("id").GetGuid();
    }

    public Task<HttpResponseMessage> UploadAsync(byte[] bytes, string fileName, string contentType)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
        var form = new MultipartFormDataContent { { file, "file", fileName } };
        return Http.PostAsync(new Uri("/api/media", UriKind.Relative), form);
    }

    private static SiteResult ReadSite(JsonElement json) => new(
        json.GetProperty("id").GetGuid(),
        json.GetProperty("slug").GetString()!,
        json.GetProperty("revision").GetInt64(),
        json.GetProperty("sourceTemplateId").ValueKind == JsonValueKind.Null ? null : json.GetProperty("sourceTemplateId").GetGuid(),
        json.GetProperty("sourceTemplateVersion").ValueKind == JsonValueKind.Null ? null : json.GetProperty("sourceTemplateVersion").GetInt32(),
        ContentJson.Deserialize<SiteDocument>(json.GetProperty("document")),
        [.. json.GetProperty("sections").EnumerateArray().Select(s => new SectionRef(
            s.GetProperty("sectionTypeId").GetGuid(),
            s.GetProperty("version").GetInt32(),
            ContentJson.Deserialize<SectionDefinition>(s.GetProperty("definition"))))]);
}

public static class TestImages
{
    public static byte[] Png(int width = 8, int height = 8) =>
        Strata.Infrastructure.Storage.PngWriter.Encode(width, height, (x, y) => ((byte)(x * 20), (byte)(y * 20), 128));
}

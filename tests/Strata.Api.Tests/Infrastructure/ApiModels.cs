using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Strata.Domain.Content;

namespace Strata.Api.Tests.Infrastructure;

public sealed record SectionTypeResult(Guid Id, long Revision, int LatestVersion, bool HasUnpublishedChanges, SectionDefinition Draft, string[] PublishIssueCodes);

public sealed record SiteResult(Guid Id, string Slug, long Revision, Guid? SourceTemplateId, int? SourceTemplateVersion, SiteDocument Document, IReadOnlyList<SectionRef> Sections);

public sealed record SectionRef(Guid SectionTypeId, int Version, SectionDefinition Definition);

public sealed record Violation(string Code, string Path, string Message);

public static class ApiJson
{
    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    public static async Task<HttpResponseMessage> ShouldHaveStatusAsync(this HttpResponseMessage response, HttpStatusCode expected)
    {
        if (response.StatusCode != expected)
        {
            var body = await response.Content.ReadAsStringAsync();
            response.StatusCode.ShouldBe(expected, body);
        }

        return response;
    }

    /// <summary>Asserts a 422 ProblemDetails response and returns its violations.</summary>
    public static async Task<IReadOnlyList<Violation>> ShouldBeRejectedAsync(this HttpResponseMessage response)
    {
        await response.ShouldHaveStatusAsync(HttpStatusCode.UnprocessableEntity);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/problem+json");
        var json = await response.ReadJsonAsync();
        return json.GetProperty("errors").Deserialize<List<Violation>>(JsonSerializerOptions.Web)!;
    }

    public static async Task ShouldBeRejectedWithAsync(this HttpResponseMessage response, string code)
    {
        var violations = await response.ShouldBeRejectedAsync();
        violations.Select(v => v.Code).ShouldContain(code, $"Violations were: {string.Join(", ", violations.Select(v => $"{v.Code} at {v.Path}"))}");
    }

    public static JsonContent Json(object value) => JsonContent.Create(value, options: ContentJson.Options);
}

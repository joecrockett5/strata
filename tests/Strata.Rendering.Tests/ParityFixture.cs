using System.Text.Json;
using Strata.Domain.Content;
using Strata.Testing;

namespace Strata.Rendering.Tests;

/// <summary>A fixtures/parity/*.json input, deserialised with the content serializer.</summary>
public sealed record ParityFixture(string Name, JsonElement Json)
{
    public string Kind => Json.GetProperty("kind").GetString()!;

    public RenderContext Context => ContentJson.Deserialize<RenderContext>(Json.GetProperty("context"));

    public string ExpectedHtml => File.ReadAllText(RepoPaths.Fixture("parity", $"{Name}.expected.html"));

    public static IEnumerable<string> Names() =>
        Directory.GetFiles(RepoPaths.Fixture("parity"), "*.json").Select(Path.GetFileNameWithoutExtension).Order().Select(n => n!);

    public static ParityFixture Load(string name) =>
        new(name, JsonDocument.Parse(RepoPaths.ReadFixture("parity", $"{name}.json")).RootElement.Clone());

    public Task<string> RenderWithRazorAsync(StrataRenderer renderer) => Kind switch
    {
        "section" => renderer.RenderSectionAsync(
            ContentJson.Deserialize<Theme>(Json.GetProperty("theme")),
            ContentJson.Deserialize<SectionDefinition>(Json.GetProperty("definition")),
            ContentJson.Deserialize<SectionInstance>(Json.GetProperty("instance")),
            Context),
        "page" => renderer.RenderPageAsync(
            ContentJson.Deserialize<SiteDocument>(Json.GetProperty("document")),
            Json.GetProperty("pageId").GetGuid(),
            ContentJson.Deserialize<Dictionary<string, SectionDefinition>>(Json.GetProperty("definitions")),
            Context),
        _ => throw new InvalidOperationException($"Unknown fixture kind '{Kind}'."),
    };
}

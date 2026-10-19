using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Strata.Domain.Content;
using Strata.Infrastructure.Content;
using Strata.Testing;

namespace Strata.Infrastructure.Tests;

/// <summary>
/// The JSON Schema is the source of truth; the C# records are hand-written. These tests fail if the
/// two drift apart.
/// </summary>
public sealed class SchemaParityTests
{
    private readonly ContentSchemaValidator validator = new();

    [Theory]
    [InlineData("kitchen-sink.section.json", ContentDocumentKind.SectionDefinition)]
    [InlineData("site.document.json", ContentDocumentKind.SiteDocument)]
    public void Shared_fixtures_are_valid_against_the_schema(string fixture, ContentDocumentKind kind)
    {
        using var json = JsonDocument.Parse(RepoPaths.ReadFixture("content", fixture));

        validator.Validate(json.RootElement, kind).ShouldBeEmpty();
    }

    [Fact]
    public void Section_definition_round_trips_through_csharp_without_loss()
    {
        AssertRoundTrip<SectionDefinition>("kitchen-sink.section.json", ContentDocumentKind.SectionDefinition);
    }

    [Fact]
    public void Site_document_round_trips_through_csharp_without_loss()
    {
        AssertRoundTrip<SiteDocument>("site.document.json", ContentDocumentKind.SiteDocument);
    }

    [Theory]
    [InlineData(typeof(Node), "ChildNode", "section")]
    [InlineData(typeof(SlotValue), "SlotValue", null)]
    public void Polymorphic_discriminators_match_the_schema(Type baseType, string unionDef, string? extraDiscriminator)
    {
        var schema = JsonNode.Parse(File.ReadAllText(Path.Combine(RepoPaths.Root, "schema", "strata-content.schema.json")))!;
        var defs = schema["$defs"]!.AsObject();
        var schemaDiscriminators = defs[unionDef]!["oneOf"]!.AsArray()
            .Select(r => r!["$ref"]!.GetValue<string>().Split('/')[^1])
            .Select(name => defs[name]!["properties"]!["$type"]!["const"]!.GetValue<string>())
            .Concat(extraDiscriminator is null ? [] : [extraDiscriminator])
            .Order()
            .ToList();

        var csharpDiscriminators = baseType.GetCustomAttributes<JsonDerivedTypeAttribute>()
            .Select(a => (string)a.TypeDiscriminator!)
            .Order()
            .ToList();

        csharpDiscriminators.ShouldBe(schemaDiscriminators);
    }

    private void AssertRoundTrip<T>(string fixture, ContentDocumentKind kind)
    {
        var original = JsonNode.Parse(RepoPaths.ReadFixture("content", fixture))!;

        var model = ContentJson.Deserialize<T>(original.ToJsonString());
        var reserialized = JsonSerializer.SerializeToNode(model, ContentJson.Options)!;

        JsonNode.DeepEquals(original, reserialized).ShouldBeTrue($"Round trip changed the document:\n{reserialized.ToJsonString(new JsonSerializerOptions { WriteIndented = true })}");
        using var doc = JsonDocument.Parse(reserialized.ToJsonString());
        validator.Validate(doc.RootElement, kind).ShouldBeEmpty();
    }
}

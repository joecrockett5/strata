using System.Text.Json;
using System.Text.Json.Nodes;
using Strata.Infrastructure.Content;
using Strata.Testing;

namespace Strata.Infrastructure.Tests;

public sealed class ContentSchemaValidatorTests
{
    private readonly ContentSchemaValidator validator = new();

    [Fact]
    public void Error_inside_a_node_union_points_at_the_offending_property()
    {
        var definition = JsonNode.Parse(RepoPaths.ReadFixture("content", "kitchen-sink.section.json"))!;
        definition["root"]!["children"]![1]!["children"]![0]!["level"] = 7;

        var violations = Validate(definition, ContentDocumentKind.SectionDefinition);

        violations.ShouldHaveSingleItem().Path.ShouldBe("/root/children/1/children/0/level");
    }

    [Fact]
    public void Unknown_primitive_type_is_reported_once_at_the_node()
    {
        var definition = JsonNode.Parse(RepoPaths.ReadFixture("content", "kitchen-sink.section.json"))!;
        definition["root"]!["children"]![0]!["$type"] = "marquee";

        var violation = Validate(definition, ContentDocumentKind.SectionDefinition).ShouldHaveSingleItem();

        violation.Path.ShouldBe("/root/children/0");
        violation.Message.ShouldContain("does not match any allowed shape");
    }

    [Fact]
    public void Unexpected_properties_are_rejected()
    {
        var site = JsonNode.Parse(RepoPaths.ReadFixture("content", "site.document.json"))!;
        site["pages"]![0]!["sections"]![0]!["style"] = "color: red";

        var violation = Validate(site, ContentDocumentKind.SiteDocument).ShouldHaveSingleItem();
        violation.Path.ShouldBe("/pages/0/sections/0/style");
        violation.Message.ShouldBe("Unexpected property.");
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("//evil.example")]
    [InlineData("data:text/html,hi")]
    public void Link_urls_must_use_an_allowed_scheme(string url)
    {
        var site = JsonNode.Parse(RepoPaths.ReadFixture("content", "site.document.json"))!;
        site["pages"]![0]!["sections"]![0]!["values"]!["ctaLink"] = JsonNode.Parse($$"""{ "$type": "link", "target": { "kind": "url", "url": {{JsonSerializer.Serialize(url)}} } }""");

        Validate(site, ContentDocumentKind.SiteDocument).ShouldNotBeEmpty();
    }

    [Fact]
    public void Theme_colours_must_be_hex()
    {
        var site = JsonNode.Parse(RepoPaths.ReadFixture("content", "site.document.json"))!;
        site["theme"]!["colors"]!["primary"] = "red";

        Validate(site, ContentDocumentKind.SiteDocument).ShouldHaveSingleItem().Path.ShouldBe("/theme/colors/primary");
    }

    private List<Strata.Domain.Content.Validation.ContentViolation> Validate(JsonNode node, ContentDocumentKind kind)
    {
        using var doc = JsonDocument.Parse(node.ToJsonString());
        return [.. validator.Validate(doc.RootElement, kind)];
    }
}

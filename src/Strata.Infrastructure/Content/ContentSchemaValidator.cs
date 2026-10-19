using System.Reflection;
using System.Text.Json;
using Json.Schema;
using Strata.Domain.Content.Validation;

namespace Strata.Infrastructure.Content;

/// <summary>The top-level content documents that can be validated.</summary>
public enum ContentDocumentKind
{
    SectionDefinition,
    SiteDocument,
    Theme,
}

public interface IContentSchemaValidator
{
    /// <summary>Validates raw JSON against a definition in schema/strata-content.schema.json.</summary>
    IReadOnlyList<ContentViolation> Validate(JsonElement json, ContentDocumentKind kind);
}

/// <summary>
/// Validates content against the embedded JSON Schema (the single source of truth shared with the
/// TypeScript types). Errors inside <c>oneOf</c> unions are narrowed to the branch selected by the
/// <c>$type</c>/<c>kind</c> discriminator so messages point at the real problem.
/// </summary>
public sealed class ContentSchemaValidator : IContentSchemaValidator
{
    private const int MaxViolations = 25;
    private static readonly string[] Discriminators = ["$type", "kind"];

    private readonly Dictionary<ContentDocumentKind, JsonSchema> schemas;

    public ContentSchemaValidator()
    {
        var buildOptions = new BuildOptions { SchemaRegistry = new SchemaRegistry() };
        var root = JsonSchema.FromText(ReadEmbeddedSchema(), buildOptions);
        var rootId = root.BaseUri;

        schemas = Enum.GetValues<ContentDocumentKind>().ToDictionary(
            kind => kind,
            kind => JsonSchema.FromText(
                $$"""{ "$schema": "https://json-schema.org/draft/2020-12/schema", "$ref": "{{rootId}}#/$defs/{{kind}}" }""",
                buildOptions,
                new Uri($"https://strata.local/schema/entry/{kind}")));
    }

    public IReadOnlyList<ContentViolation> Validate(JsonElement json, ContentDocumentKind kind)
    {
        var results = schemas[kind].Evaluate(json, new EvaluationOptions { OutputFormat = OutputFormat.Hierarchical });
        if (results.IsValid)
        {
            return [];
        }

        var violations = new List<ContentViolation>();
        Collect(results, violations);
        if (violations.Count == 0)
        {
            violations.Add(new(ViolationCodes.SchemaInvalid, string.Empty, "The document does not match the content schema."));
        }

        return violations.DistinctBy(v => (v.Path, v.Message)).Take(MaxViolations).ToList();
    }

    /// <summary>Keywords whose errors only summarise failures reported by their children.</summary>
    private static readonly HashSet<string> SummaryKeywords =
        ["properties", "items", "prefixItems", "additionalProperties", "patternProperties", "propertyNames", "$ref", "allOf", "anyOf", "oneOf", "dependentSchemas", "if", "then", "else"];

    private static void Collect(EvaluationResults node, List<ContentViolation> violations)
    {
        if (node.IsValid)
        {
            return;
        }

        var path = node.InstanceLocation.ToString();
        var children = node.Details ?? [];

        if (node.Errors?.ContainsKey("oneOf") == true)
        {
            var branches = children.Where(IsOneOfBranch).ToList();
            var selected = branches.Where(branch => !FailsDiscriminator(branch, path)).ToList();
            if (selected.Count == 1)
            {
                Collect(selected[0], violations);
            }
            else
            {
                violations.Add(new(ViolationCodes.SchemaInvalid, path, "Value does not match any allowed shape."));
            }

            children = [.. children.Where(c => !IsOneOfBranch(c))];
        }

        foreach (var (keyword, message) in node.Errors ?? new Dictionary<string, string>())
        {
            if (keyword.Length == 0)
            {
                // A "false" schema: produced for properties that additionalProperties forbids.
                violations.Add(new(ViolationCodes.SchemaInvalid, path, "Unexpected property."));
            }
            else if (!SummaryKeywords.Contains(keyword))
            {
                violations.Add(new(ViolationCodes.SchemaInvalid, path, message));
            }
        }

        foreach (var child in children)
        {
            Collect(child, violations);
        }
    }

    private static bool IsOneOfBranch(EvaluationResults result)
    {
        var evaluationPath = result.EvaluationPath.ToString();
        var marker = evaluationPath.LastIndexOf("/oneOf/", StringComparison.Ordinal);
        return marker >= 0 && evaluationPath[(marker + "/oneOf/".Length)..].All(char.IsAsciiDigit);
    }

    /// <summary>True when the branch rejected the discriminator (or JSON type) of the value at <paramref name="path"/>.</summary>
    private static bool FailsDiscriminator(EvaluationResults branch, string path)
    {
        var discriminatorPaths = Discriminators.Select(d => $"{path}/{d}").ToHashSet();
        return Flatten(branch).Any(r =>
            !r.IsValid
            && r.Errors is { Count: > 0 } errors
            && ((errors.ContainsKey("const") && discriminatorPaths.Contains(r.InstanceLocation.ToString()))
                || (errors.ContainsKey("type") && r.InstanceLocation.ToString() == path)));
    }

    private static IEnumerable<EvaluationResults> Flatten(EvaluationResults node) =>
        new[] { node }.Concat((node.Details ?? []).SelectMany(Flatten));

    private static string ReadEmbeddedSchema()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("strata-content.schema.json")
            ?? throw new InvalidOperationException("The content schema is not embedded in Strata.Infrastructure.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}

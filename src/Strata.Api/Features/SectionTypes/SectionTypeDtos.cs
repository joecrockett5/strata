using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using Strata.Domain.SectionTypes;

namespace Strata.Api.Features.SectionTypes;

public sealed record SectionTypeSummary(
    Guid Id,
    string Name,
    string Category,
    int LatestVersion,
    bool HasUnpublishedChanges,
    bool Archived,
    DateTimeOffset UpdatedAt)
{
    public static SectionTypeSummary From(SectionType type) =>
        new(type.Id, type.Name, type.Category, type.LatestVersion, type.HasUnpublishedChanges, type.IsArchived, type.UpdatedAt);
}

/// <summary>A section type with its draft definition (a <c>SectionDefinition</c> from the content schema).</summary>
public sealed record SectionTypeDetail(
    Guid Id,
    string Name,
    string Category,
    int LatestVersion,
    bool HasUnpublishedChanges,
    bool Archived,
    long Revision,
    JsonElement Draft,
    IReadOnlyList<ContentViolation> PublishIssues,
    DateTimeOffset UpdatedAt)
{
    public static SectionTypeDetail From(SectionType type) => new(
        type.Id,
        type.Name,
        type.Category,
        type.LatestVersion,
        type.HasUnpublishedChanges,
        type.IsArchived,
        type.DraftRevision,
        ContentJson.ToElement(type.Draft),
        SectionDefinitionRules.Validate(type.Draft),
        type.UpdatedAt);
}

public sealed record SectionTypeVersionDto(Guid SectionTypeId, int Version, string Name, string Category, JsonElement Definition, DateTimeOffset PublishedAt)
{
    public static SectionTypeVersionDto From(SectionTypeVersion version) =>
        new(version.SectionTypeId, version.Version, version.Name, version.Category, ContentJson.ToElement(version.Definition), version.PublishedAt);
}

public sealed record CreateSectionTypeRequest(
    [property: Required, StringLength(120, MinimumLength = 1)] string Name,
    [property: Required, StringLength(60, MinimumLength = 1)] string Category,
    JsonElement? Definition);

public sealed record UpdateSectionTypeRequest(
    [property: Required, StringLength(120, MinimumLength = 1)] string Name,
    [property: Required, StringLength(60, MinimumLength = 1)] string Category,
    JsonElement Definition);

public sealed record DuplicateSectionTypeRequest([property: StringLength(120, MinimumLength = 1)] string? Name);

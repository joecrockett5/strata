using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Strata.Api.Features.Content;
using Strata.Domain.Content;
using Strata.Domain.Templates;

namespace Strata.Api.Features.Templates;

public sealed record TemplateSummary(
    Guid Id,
    string Name,
    string Description,
    Guid? ThumbnailMediaId,
    int LatestVersion,
    bool HasUnpublishedChanges,
    bool Archived,
    DateTimeOffset UpdatedAt)
{
    public static TemplateSummary From(StarterTemplate t) =>
        new(t.Id, t.Name, t.Description, t.ThumbnailMediaId, t.LatestVersion, t.HasUnpublishedChanges, t.IsArchived, t.UpdatedAt);
}

/// <summary>A template with its draft <c>SiteDocument</c> and the section versions it references.</summary>
public sealed record TemplateDetail(
    Guid Id,
    string Name,
    string Description,
    Guid? ThumbnailMediaId,
    int LatestVersion,
    bool HasUnpublishedChanges,
    bool Archived,
    long Revision,
    JsonElement Document,
    List<PublishedSectionDto> Sections,
    DateTimeOffset UpdatedAt)
{
    public static TemplateDetail From(StarterTemplate t, List<PublishedSectionDto> sections) => new(
        t.Id, t.Name, t.Description, t.ThumbnailMediaId, t.LatestVersion, t.HasUnpublishedChanges, t.IsArchived,
        t.DraftRevision, ContentJson.ToElement(t.Draft), sections, t.UpdatedAt);
}

/// <summary>What site owners see when choosing a starter template.</summary>
public sealed record PublishedTemplateDto(Guid Id, int Version, string Name, string Description, Guid? ThumbnailMediaId, int PageCount);

public sealed record CreateTemplateRequest(
    [property: Required, StringLength(120, MinimumLength = 1)] string Name,
    [property: StringLength(500)] string? Description,
    Guid? ThemePresetId);

public sealed record UpdateTemplateRequest(
    [property: Required, StringLength(120, MinimumLength = 1)] string Name,
    [property: Required, StringLength(500)] string Description,
    Guid? ThumbnailMediaId,
    JsonElement Document);

public sealed record TemplateVersionDto(Guid TemplateId, int Version, DateTimeOffset PublishedAt);

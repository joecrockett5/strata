using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Strata.Api.Features.Content;
using Strata.Domain.Content;
using Strata.Domain.Sites;

namespace Strata.Api.Features.Sites;

public sealed record SiteSummary(
    Guid Id,
    string Name,
    string Slug,
    bool IsPublished,
    bool HasUnpublishedChanges,
    DateTimeOffset UpdatedAt)
{
    public static SiteSummary From(Site site) =>
        new(site.Id, site.Name, site.Slug, site.CurrentPublishedVersionId is not null, site.HasUnpublishedChanges, site.UpdatedAt);
}

/// <summary>A site with its draft <c>SiteDocument</c> and every section version the draft references.</summary>
public sealed record SiteDetail(
    Guid Id,
    string Name,
    string Slug,
    long Revision,
    bool IsPublished,
    bool HasUnpublishedChanges,
    Guid? SourceTemplateId,
    int? SourceTemplateVersion,
    JsonElement Document,
    List<PublishedSectionDto> Sections,
    DateTimeOffset UpdatedAt)
{
    public static SiteDetail From(Site site, List<PublishedSectionDto> sections) => new(
        site.Id, site.Name, site.Slug, site.DraftRevision, site.CurrentPublishedVersionId is not null, site.HasUnpublishedChanges,
        site.SourceTemplateId, site.SourceTemplateVersion, ContentJson.ToElement(site.Draft), sections, site.UpdatedAt);
}

public sealed record CreateSiteRequest(
    [property: Required, StringLength(120, MinimumLength = 1)] string Name,
    [property: Required, StringLength(40, MinimumLength = 3)] string Slug,
    Guid? TemplateId);

public sealed record UpdateSiteRequest(
    [property: Required, StringLength(120, MinimumLength = 1)] string Name,
    [property: Required, StringLength(40, MinimumLength = 3)] string Slug);

public sealed record SaveSiteDraftRequest(JsonElement Document);

/// <summary>Response to a draft save: the new revision and the stored (sanitised) document.</summary>
public sealed record SaveSiteDraftResponse(long Revision, bool HasUnpublishedChanges, JsonElement Document);

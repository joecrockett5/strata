using System.Text.RegularExpressions;
using Strata.Domain.Common;
using Strata.Domain.Content;

namespace Strata.Domain.Sites;

/// <summary>
/// An owner's website. Created as an independent copy of a starter template version (or blank);
/// later template changes never propagate.
/// </summary>
public sealed partial class Site
{
    private Site()
    {
    }

    public Guid Id { get; private set; }
    public Guid OwnerId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public SiteDocument Draft { get; private set; } = null!;
    public long DraftRevision { get; private set; }
    public Guid? SourceTemplateId { get; private set; }
    public int? SourceTemplateVersion { get; private set; }
    public Guid? CurrentPublishedVersionId { get; private set; }

    /// <summary>Draft revision captured by the current published version.</summary>
    public long? PublishedDraftRevision { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public bool HasUnpublishedChanges => PublishedDraftRevision != DraftRevision;

    public static Site Create(Guid ownerId, string name, string slug, SiteDocument draft, Guid? sourceTemplateId, int? sourceTemplateVersion, DateTimeOffset now)
    {
        EnsureValidSlug(slug);
        return new Site
        {
            Id = Guid.CreateVersion7(now),
            OwnerId = ownerId,
            Name = name,
            Slug = slug,
            Draft = draft,
            DraftRevision = 1,
            SourceTemplateId = sourceTemplateId,
            SourceTemplateVersion = sourceTemplateVersion,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    public void Rename(string name, string slug, DateTimeOffset now)
    {
        EnsureValidSlug(slug);
        Name = name;
        Slug = slug;
        UpdatedAt = now;
    }

    public void UpdateDraft(SiteDocument draft, long expectedRevision, DateTimeOffset now)
    {
        if (expectedRevision != DraftRevision)
        {
            throw new DraftConflictException(expectedRevision, DraftRevision);
        }

        Draft = draft;
        DraftRevision++;
        UpdatedAt = now;
    }

    /// <summary>Records that <paramref name="version"/> is now live. Snapshot creation happens in the caller.</summary>
    public void MarkPublished(PublishedSiteVersion version)
    {
        CurrentPublishedVersionId = version.Id;
        PublishedDraftRevision = version.SourceDraftRevision;
    }

    public static bool IsValidSlug(string slug) => slug.Length is >= 3 and <= 40 && SlugPattern().IsMatch(slug);

    private static void EnsureValidSlug(string slug)
    {
        if (!IsValidSlug(slug))
        {
            throw new DomainRuleException("Site slugs are 3–40 lower-case letters, digits and single hyphens.");
        }
    }

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();
}

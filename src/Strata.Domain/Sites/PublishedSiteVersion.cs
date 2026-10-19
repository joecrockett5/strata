using Strata.Domain.Content;

namespace Strata.Domain.Sites;

/// <summary>
/// Immutable snapshot of a whole site at publish time. Public pages render only from this, and it
/// embeds the exact section definitions used so rendering needs no other lookups.
/// </summary>
public sealed class PublishedSiteVersion
{
    private PublishedSiteVersion()
    {
    }

    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public int VersionNumber { get; private set; }
    public PublishedSnapshot Snapshot { get; private set; } = null!;
    public long SourceDraftRevision { get; private set; }
    public Guid PublishedBy { get; private set; }
    public DateTimeOffset PublishedAt { get; private set; }

    public static PublishedSiteVersion Create(Site site, int versionNumber, PublishedSnapshot snapshot, Guid publishedBy, DateTimeOffset now) => new()
    {
        Id = Guid.CreateVersion7(now),
        SiteId = site.Id,
        VersionNumber = versionNumber,
        Snapshot = snapshot,
        SourceDraftRevision = site.DraftRevision,
        PublishedBy = publishedBy,
        PublishedAt = now,
    };
}

/// <summary>The site document plus the section definitions it references, keyed by "typeId@version".</summary>
public sealed record PublishedSnapshot(SiteDocument Document, IReadOnlyDictionary<string, SectionDefinition> Definitions);

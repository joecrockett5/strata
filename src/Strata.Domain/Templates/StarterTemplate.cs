using Strata.Domain.Common;
using Strata.Domain.Content;

namespace Strata.Domain.Templates;

/// <summary>A designer-made blueprint for a whole site, versioned like section types.</summary>
public sealed class StarterTemplate
{
    private readonly List<StarterTemplateVersion> versions = [];

    private StarterTemplate()
    {
    }

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public Guid? ThumbnailMediaId { get; private set; }
    public SiteDocument Draft { get; private set; } = null!;
    public long DraftRevision { get; private set; }
    public long? PublishedDraftRevision { get; private set; }
    public int LatestVersion { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }

    public IReadOnlyList<StarterTemplateVersion> Versions => versions;

    public bool IsArchived => ArchivedAt is not null;
    public bool HasUnpublishedChanges => PublishedDraftRevision != DraftRevision;

    public static StarterTemplate Create(string name, string description, SiteDocument draft, Guid createdBy, DateTimeOffset now) => new()
    {
        Id = Guid.CreateVersion7(now),
        Name = name,
        Description = description,
        Draft = draft,
        DraftRevision = 1,
        CreatedBy = createdBy,
        CreatedAt = now,
        UpdatedAt = now,
    };

    public void UpdateDraft(string name, string description, Guid? thumbnailMediaId, SiteDocument draft, long expectedRevision, DateTimeOffset now)
    {
        if (expectedRevision != DraftRevision)
        {
            throw new DraftConflictException(expectedRevision, DraftRevision);
        }

        Name = name;
        Description = description;
        ThumbnailMediaId = thumbnailMediaId;
        Draft = draft;
        DraftRevision++;
        UpdatedAt = now;
    }

    public StarterTemplateVersion PublishVersion(Guid publishedBy, DateTimeOffset now)
    {
        if (IsArchived)
        {
            throw new DomainRuleException("Archived templates cannot be published.");
        }

        var version = new StarterTemplateVersion(Id, LatestVersion + 1, Name, Description, ThumbnailMediaId, Draft, publishedBy, now);
        versions.Add(version);
        LatestVersion = version.Version;
        PublishedDraftRevision = DraftRevision;
        UpdatedAt = now;
        return version;
    }

    public void Archive(DateTimeOffset now) => ArchivedAt ??= now;

    public void Restore() => ArchivedAt = null;
}

public sealed class StarterTemplateVersion
{
    private StarterTemplateVersion()
    {
    }

    internal StarterTemplateVersion(Guid templateId, int version, string name, string description, Guid? thumbnailMediaId, SiteDocument document, Guid publishedBy, DateTimeOffset publishedAt)
    {
        TemplateId = templateId;
        Version = version;
        Name = name;
        Description = description;
        ThumbnailMediaId = thumbnailMediaId;
        Document = document;
        PublishedBy = publishedBy;
        PublishedAt = publishedAt;
    }

    public Guid TemplateId { get; private set; }
    public int Version { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public Guid? ThumbnailMediaId { get; private set; }
    public SiteDocument Document { get; private set; } = null!;
    public Guid PublishedBy { get; private set; }
    public DateTimeOffset PublishedAt { get; private set; }
}

using Strata.Domain.Common;
using Strata.Domain.Content;

namespace Strata.Domain.SectionTypes;

/// <summary>
/// A designer-made section type: an editable draft plus immutable published versions.
/// </summary>
public sealed class SectionType
{
    private readonly List<SectionTypeVersion> versions = [];

    private SectionType()
    {
    }

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;
    public SectionDefinition Draft { get; private set; } = null!;

    /// <summary>Optimistic-concurrency token for the draft; incremented on every save.</summary>
    public long DraftRevision { get; private set; }

    /// <summary>Draft revision at the last publish; differs from <see cref="DraftRevision"/> when there are unpublished changes.</summary>
    public long? PublishedDraftRevision { get; private set; }

    /// <summary>Latest published version number, or 0 when never published.</summary>
    public int LatestVersion { get; private set; }

    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }

    public IReadOnlyList<SectionTypeVersion> Versions => versions;

    public bool IsArchived => ArchivedAt is not null;
    public bool HasUnpublishedChanges => PublishedDraftRevision != DraftRevision;

    public static SectionType Create(string name, string category, SectionDefinition draft, Guid createdBy, DateTimeOffset now) => new()
    {
        Id = Guid.CreateVersion7(now),
        Name = name,
        Category = category,
        Draft = draft,
        DraftRevision = 1,
        CreatedBy = createdBy,
        CreatedAt = now,
        UpdatedAt = now,
    };

    public void UpdateDraft(string name, string category, SectionDefinition draft, long expectedRevision, DateTimeOffset now)
    {
        if (expectedRevision != DraftRevision)
        {
            throw new DraftConflictException(expectedRevision, DraftRevision);
        }

        Name = name;
        Category = category;
        Draft = draft;
        DraftRevision++;
        UpdatedAt = now;
    }

    /// <summary>Freezes the current draft as the next immutable version. Callers validate the draft first.</summary>
    public SectionTypeVersion PublishVersion(Guid publishedBy, DateTimeOffset now)
    {
        if (IsArchived)
        {
            throw new DomainRuleException("Archived section types cannot be published.");
        }

        var version = new SectionTypeVersion(Id, LatestVersion + 1, Name, Category, Draft, publishedBy, now);
        versions.Add(version);
        LatestVersion = version.Version;
        PublishedDraftRevision = DraftRevision;
        UpdatedAt = now;
        return version;
    }

    public SectionType Duplicate(string name, Guid createdBy, DateTimeOffset now) =>
        Create(name, Category, Draft, createdBy, now);

    public void Archive(DateTimeOffset now) => ArchivedAt ??= now;

    public void Restore() => ArchivedAt = null;
}

/// <summary>An immutable published version of a section type.</summary>
public sealed class SectionTypeVersion
{
    private SectionTypeVersion()
    {
    }

    internal SectionTypeVersion(Guid sectionTypeId, int version, string name, string category, SectionDefinition definition, Guid publishedBy, DateTimeOffset publishedAt)
    {
        SectionTypeId = sectionTypeId;
        Version = version;
        Name = name;
        Category = category;
        Definition = definition;
        PublishedBy = publishedBy;
        PublishedAt = publishedAt;
    }

    public Guid SectionTypeId { get; private set; }
    public int Version { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;
    public SectionDefinition Definition { get; private set; } = null!;
    public Guid PublishedBy { get; private set; }
    public DateTimeOffset PublishedAt { get; private set; }

    public SectionVersionRef Ref => new(SectionTypeId, Version);
}

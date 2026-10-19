using System.Text.Json.Serialization;

namespace Strata.Domain.Content;

public sealed record RepeaterItem(Guid Id, IReadOnlyDictionary<string, SlotValue> Values);

/// <summary>
/// A use of a section type. Pins a published version and stores values for editable slots only;
/// absent values render the slot default.
/// </summary>
public sealed record SectionInstance
{
    public required Guid Id { get; init; }
    public required Guid SectionTypeId { get; init; }
    public required int Version { get; init; }
    public SectionLock Lock { get; init; } = SectionLock.None;
    public bool Hidden { get; init; }
    public IReadOnlyDictionary<string, SlotValue> Values { get; init; } = new Dictionary<string, SlotValue>();
    public IReadOnlyDictionary<string, IReadOnlyList<RepeaterItem>> Repeaters { get; init; } =
        new Dictionary<string, IReadOnlyList<RepeaterItem>>();

    [JsonIgnore]
    public SectionVersionRef VersionRef => new(SectionTypeId, Version);
}

/// <summary>Identifies an immutable published section type version.</summary>
public readonly record struct SectionVersionRef(Guid SectionTypeId, int Version)
{
    public override string ToString() => $"{SectionTypeId}@{Version}";
}

public sealed record PageSeo(string Title, string Description);

public sealed record Page
{
    public required Guid Id { get; init; }
    public required string Title { get; init; }

    /// <summary>Flat kebab-case slug; empty for the home page.</summary>
    public required string Slug { get; init; }

    public bool ShowInNav { get; init; } = true;
    public PageSeo Seo { get; init; } = new(string.Empty, string.Empty);
    public IReadOnlyList<SectionInstance> Sections { get; init; } = [];

    [JsonIgnore]
    public bool IsHome => Slug.Length == 0;
}

// Init properties rather than a positional record: ContentJson serialises Logo through its
// polymorphic base, which constructor-parameter binding (matched by type) does not allow.
public sealed record SiteSettings
{
    public required string FirmName { get; init; }
    public required ImageValue? Logo { get; init; }
}

/// <summary>A whole site: used for site drafts, starter templates and published snapshots.</summary>
public sealed record SiteDocument
{
    public const int CurrentSchemaVersion = 1;

    public int SchemaVersion { get; init; } = CurrentSchemaVersion;
    public required SiteSettings Settings { get; init; }
    public required Theme Theme { get; init; }

    /// <summary>Tokens the template designer locked; owners cannot change them.</summary>
    public IReadOnlyList<ThemeToken> ThemeLocks { get; init; } = [];

    public SectionInstance? Header { get; init; }
    public SectionInstance? Footer { get; init; }
    public required IReadOnlyList<Page> Pages { get; init; }

    /// <summary>All section instances with a stable region name (header, footer or page id).</summary>
    public IEnumerable<LocatedInstance> AllInstances()
    {
        if (Header is not null)
        {
            yield return new LocatedInstance(Header, Region.Header, "/header");
        }

        if (Footer is not null)
        {
            yield return new LocatedInstance(Footer, Region.Footer, "/footer");
        }

        for (var p = 0; p < Pages.Count; p++)
        {
            var page = Pages[p];
            for (var s = 0; s < page.Sections.Count; s++)
            {
                yield return new LocatedInstance(page.Sections[s], Region.ForPage(page.Id), $"/pages/{p}/sections/{s}");
            }
        }
    }

    public static SiteDocument Blank(string firmName) => new()
    {
        Settings = new SiteSettings { FirmName = firmName, Logo = null },
        Theme = Theme.Default,
        Pages =
        [
            new Page { Id = Guid.NewGuid(), Title = "Home", Slug = string.Empty, Seo = new PageSeo(firmName, string.Empty) },
        ],
    };
}

/// <summary>Where an instance lives: the global header/footer or a specific page.</summary>
public readonly record struct Region(string Value)
{
    public static Region Header { get; } = new("header");
    public static Region Footer { get; } = new("footer");

    public static Region ForPage(Guid pageId) => new($"page:{pageId}");

    public override string ToString() => Value;
}

public sealed record LocatedInstance(SectionInstance Instance, Region Region, string Path);

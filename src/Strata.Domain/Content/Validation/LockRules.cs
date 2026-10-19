namespace Strata.Domain.Content.Validation;

/// <summary>
/// Locking rules that compare an incoming document with the stored one. The server is
/// authoritative: the editor mirrors these rules but never replaces them.
/// </summary>
public static class LockRules
{
    /// <summary>
    /// Rule 4 (versions), for every author: an existing instance keeps its pinned version, and a new
    /// instance must pin a published version of a section type that is not archived.
    /// </summary>
    public static IReadOnlyList<ContentViolation> ValidateVersionPins(
        SiteDocument? previous,
        SiteDocument next,
        ContentValidationContext context)
    {
        var violations = new List<ContentViolation>();
        var before = IndexById(previous);

        foreach (var (instance, _, path) in next.AllInstances())
        {
            if (before.TryGetValue(instance.Id, out var old))
            {
                if (old.Instance.VersionRef != instance.VersionRef)
                {
                    violations.Add(new(ViolationCodes.VersionPinChanged, $"{path}/version",
                        $"An existing section must keep its pinned version {old.Instance.VersionRef}; upgrading is not supported."));
                }
            }
            else if (context.Sections.TryGetValue(instance.VersionRef, out var section) && section.TypeArchived)
            {
                violations.Add(new(ViolationCodes.SectionTypeArchived, $"{path}/sectionTypeId",
                    $"'{section.Name}' is archived and cannot be added."));
            }
        }

        return violations;
    }

    /// <summary>
    /// Rules 2 (section locks) and 3 (theme token locks) for site owners. Lock flags come from the
    /// starter template and can only be set by designers.
    /// </summary>
    public static IReadOnlyList<ContentViolation> ValidateOwnerChanges(SiteDocument previous, SiteDocument next)
    {
        var violations = new List<ContentViolation>();
        ValidateSectionLocks(previous, next, violations);
        ValidateThemeLocks(previous, next, violations);
        return violations;
    }

    private static void ValidateSectionLocks(SiteDocument previous, SiteDocument next, List<ContentViolation> violations)
    {
        var before = IndexById(previous);
        var after = IndexById(next);

        foreach (var old in before.Values.Where(i => i.Instance.Lock != SectionLock.None))
        {
            var locked = old.Instance.Lock == SectionLock.Locked;
            if (!after.TryGetValue(old.Instance.Id, out var current))
            {
                violations.Add(locked
                    ? new(ViolationCodes.LockedSectionRemoved, old.Path, "A locked section cannot be removed.")
                    : new(ViolationCodes.RequiredSectionRemoved, old.Path, "A required section cannot be removed."));
                continue;
            }

            if (current.Region != old.Region)
            {
                violations.Add(locked
                    ? new(ViolationCodes.LockedSectionMoved, current.Path, "A locked section cannot be moved to another page.")
                    : new(ViolationCodes.RequiredSectionMoved, current.Path, "A required section cannot be moved to another page."));
            }

            if (current.Instance.Hidden)
            {
                violations.Add(new(ViolationCodes.LockedOrRequiredHidden, $"{current.Path}/hidden", "Locked and required sections cannot be hidden."));
            }

            if (locked && current.Instance.Lock == SectionLock.Locked && !ContentJson.StructurallyEqual(old.Instance, current.Instance))
            {
                violations.Add(new(ViolationCodes.LockedSectionModified, current.Path, "A locked section cannot be edited."));
            }
        }

        foreach (var current in after.Values)
        {
            var oldLock = before.TryGetValue(current.Instance.Id, out var old) ? old.Instance.Lock : SectionLock.None;
            if (current.Instance.Lock != oldLock)
            {
                violations.Add(new(ViolationCodes.SectionLockChanged, $"{current.Path}/lock", "Section lock flags can only be set in starter templates."));
            }
        }

        // Locked sections keep their order relative to each other on a page. Other sections may be
        // added, removed or reordered around them (see PLAN.md §5, "locked sections cannot be moved").
        foreach (var page in next.Pages)
        {
            var region = Region.ForPage(page.Id);
            var expected = previous.Pages.FirstOrDefault(p => p.Id == page.Id)?.Sections
                .Where(s => s.Lock == SectionLock.Locked && after.TryGetValue(s.Id, out var a) && a.Region == region)
                .Select(s => s.Id)
                .ToList() ?? [];
            var actual = page.Sections
                .Where(s => s.Lock == SectionLock.Locked && before.ContainsKey(s.Id))
                .Select(s => s.Id)
                .ToList();
            if (!expected.SequenceEqual(actual))
            {
                var index = next.Pages.ToList().IndexOf(page);
                violations.Add(new(ViolationCodes.LockedSectionMoved, $"/pages/{index}/sections", "Locked sections cannot be reordered."));
            }
        }
    }

    private static void ValidateThemeLocks(SiteDocument previous, SiteDocument next, List<ContentViolation> violations)
    {
        if (!previous.ThemeLocks.ToHashSet().SetEquals(next.ThemeLocks))
        {
            violations.Add(new(ViolationCodes.ThemeLocksChanged, "/themeLocks", "Theme token locks can only be changed in starter templates."));
        }

        foreach (var token in previous.ThemeLocks)
        {
            if (previous.Theme.ValueOf(token) != next.Theme.ValueOf(token))
            {
                violations.Add(new(ViolationCodes.ThemeTokenLocked, ThemeTokenPaths.PointerOf(token), $"The theme token '{ThemeTokenPaths.NameOf(token)}' is locked."));
            }
        }
    }

    private static Dictionary<Guid, LocatedInstance> IndexById(SiteDocument? document)
    {
        var index = new Dictionary<Guid, LocatedInstance>();
        if (document is not null)
        {
            foreach (var located in document.AllInstances())
            {
                index.TryAdd(located.Instance.Id, located);
            }
        }

        return index;
    }
}

public static class ThemeTokenPaths
{
    /// <summary>The token path as used in the schema, e.g. <c>colors.primary</c>.</summary>
    public static string NameOf(ThemeToken token) => token switch
    {
        ThemeToken.Primary => "colors.primary",
        ThemeToken.OnPrimary => "colors.onPrimary",
        ThemeToken.Secondary => "colors.secondary",
        ThemeToken.Accent => "colors.accent",
        ThemeToken.Background => "colors.background",
        ThemeToken.Surface => "colors.surface",
        ThemeToken.Text => "colors.text",
        ThemeToken.MutedText => "colors.mutedText",
        ThemeToken.HeadingFont => "fonts.heading",
        ThemeToken.BodyFont => "fonts.body",
        ThemeToken.Radius => "radius",
        _ => throw new ArgumentOutOfRangeException(nameof(token), token, null),
    };

    public static string PointerOf(ThemeToken token) => "/theme/" + NameOf(token).Replace('.', '/');
}

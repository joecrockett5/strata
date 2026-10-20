using Strata.Domain.Content;

namespace Strata.Domain.Publishing;

public enum IssueSeverity
{
    /// <summary>Blocks publishing.</summary>
    Error,

    /// <summary>Shown, but publishing is allowed.</summary>
    Warning,
}

public static class PublishIssueCodes
{
    public const string RequiredEmpty = "publish.requiredEmpty";
    public const string MissingAlt = "publish.missingAlt";
    public const string BrokenLink = "publish.brokenLink";
    public const string MissingSection = "publish.missingSection";
    public const string HeadingOneCount = "publish.h1Count";
    public const string SkippedHeading = "publish.skippedHeadingLevel";
    public const string Contrast = "publish.contrast";
}

/// <summary>
/// One finding. <see cref="PageId"/> and <see cref="InstanceId"/> let the editor jump to the
/// section concerned (header/footer issues have no page).
/// </summary>
public sealed record PublishIssue(
    IssueSeverity Severity,
    string Code,
    string Message,
    string Path,
    Guid? PageId = null,
    Guid? InstanceId = null,
    string? SlotKey = null);

/// <summary>
/// Accessibility and integrity checks run across every page before publishing. Hidden sections
/// are skipped because they are not published.
/// </summary>
public static class PublishChecks
{
    public static IReadOnlyList<PublishIssue> Run(SiteDocument document, IReadOnlyDictionary<string, SectionDefinition> definitions)
    {
        var issues = new List<PublishIssue>();
        var pageIds = document.Pages.Select(p => p.Id).ToHashSet();

        if (document.Settings.Logo is { MediaId: not null } logo && string.IsNullOrWhiteSpace(logo.Alt))
        {
            issues.Add(new(IssueSeverity.Error, PublishIssueCodes.MissingAlt, "The logo needs alt text.", "/settings/logo"));
        }

        foreach (var (instance, region, path) in document.AllInstances())
        {
            if (instance.Hidden)
            {
                continue;
            }

            Guid? pageId = region == Region.Header || region == Region.Footer ? null : Guid.Parse(region.Value["page:".Length..]);
            if (!definitions.TryGetValue(instance.VersionRef.ToString(), out var definition))
            {
                issues.Add(new(IssueSeverity.Error, PublishIssueCodes.MissingSection, "A section's definition could not be found.", path, pageId, instance.Id));
                continue;
            }

            foreach (var (_, slot, value, itemId) in RenderedSlots(definition, instance))
            {
                var slotPath = itemId is null ? $"{path}/values/{slot.Key}" : $"{path}/repeaters/{itemId}/{slot.Key}";
                void Add(string code, string message) =>
                    issues.Add(new(IssueSeverity.Error, code, message, slotPath, pageId, instance.Id, slot.Key));

                if (slot.Required && IsEmpty(value))
                {
                    Add(PublishIssueCodes.RequiredEmpty, $"“{slot.Label}” is required.");
                }

                if (value is ImageValue { MediaId: not null } image && string.IsNullOrWhiteSpace(image.Alt))
                {
                    Add(PublishIssueCodes.MissingAlt, $"The image “{slot.Label}” needs alt text.");
                }

                if (value is LinkValue { Target: PageLinkTarget target } && !pageIds.Contains(target.PageId))
                {
                    Add(PublishIssueCodes.BrokenLink, $"“{slot.Label}” links to a page that no longer exists.");
                }
            }
        }

        foreach (var page in document.Pages)
        {
            CheckHeadings(document, page, definitions, issues);
        }

        foreach (var (pair, ratio) in Contrast.ThemePairs(document.Theme))
        {
            if (ratio < Contrast.AaNormalText)
            {
                issues.Add(new(IssueSeverity.Warning, PublishIssueCodes.Contrast,
                    $"Theme contrast for {pair} is {ratio:0.00}:1, below WCAG AA (4.5:1).", "/theme/colors"));
            }
        }

        return issues;
    }

    private static bool IsEmpty(SlotValue value) => value switch
    {
        TextValue text => string.IsNullOrWhiteSpace(text.Text),
        RichTextValue rich => RichTextMetrics.VisibleLength(rich.Html) == 0,
        ImageValue image => image.MediaId is null,
        LinkValue link => link.Target is null,
        _ => false,
    };

    /// <summary>The value each slot renders with (per repeater item where relevant), in document order.</summary>
    private static IEnumerable<RenderedSlot> RenderedSlots(SectionDefinition definition, SectionInstance instance) =>
        Slots(definition.Root, instance, instance.Values, null);

    private static IEnumerable<RenderedSlot> Slots(Node node, SectionInstance instance, IReadOnlyDictionary<string, SlotValue> values, Guid? itemId)
    {
        if (node is RepeaterNode repeater)
        {
            foreach (var item in Items(repeater, instance))
            {
                foreach (var child in repeater.Children)
                {
                    foreach (var slot in Slots(child, instance, item.Values, item.Id == Guid.Empty ? null : item.Id))
                    {
                        yield return slot;
                    }
                }
            }

            yield break;
        }

        foreach (var slot in node.OwnSlots())
        {
            yield return new RenderedSlot(node, slot, Effective(slot, values), itemId);
        }

        foreach (var child in node.ChildNodes())
        {
            foreach (var slot in Slots(child, instance, values, itemId))
            {
                yield return slot;
            }
        }
    }

    private sealed record RenderedSlot(Node Owner, SlotDefinition Slot, SlotValue Value, Guid? ItemId);

    private static IReadOnlyList<RepeaterItem> Items(RepeaterNode node, SectionInstance instance) =>
        instance.Repeaters.TryGetValue(node.Key, out var items)
            ? items
            : [.. Enumerable.Range(0, node.DefaultItemCount).Select(_ => new RepeaterItem(Guid.Empty, new Dictionary<string, SlotValue>()))];

    /// <summary>Locked slots and missing values use the designer's default (rule 1).</summary>
    private static SlotValue Effective(SlotDefinition slot, IReadOnlyDictionary<string, SlotValue> values) =>
        !slot.IsLocked && values.TryGetValue(slot.Key, out var value) && value.Type == slot.Type ? value : slot.DefaultValue();

    private static void CheckHeadings(SiteDocument document, Page page, IReadOnlyDictionary<string, SectionDefinition> definitions, List<PublishIssue> issues)
    {
        var instances = new[] { document.Header }.Concat(page.Sections).Append(document.Footer)
            .OfType<SectionInstance>()
            .Where(i => !i.Hidden);

        var levels = new List<(int Level, Guid InstanceId)>();
        foreach (var instance in instances)
        {
            if (!definitions.TryGetValue(instance.VersionRef.ToString(), out var definition))
            {
                continue;
            }

            foreach (var (owner, slot, value, _) in RenderedSlots(definition, instance))
            {
                // Empty headings are omitted from the published page, so they do not count.
                if (owner is HeadingNode heading && ReferenceEquals(heading.Text, slot) && value is TextValue text && !string.IsNullOrWhiteSpace(text.Text))
                {
                    levels.Add((heading.Level, instance.Id));
                }
            }
        }

        var pageIndex = document.Pages.ToList().IndexOf(page);
        var path = $"/pages/{pageIndex}";
        var h1s = levels.Count(l => l.Level == 1);
        if (h1s != 1)
        {
            issues.Add(new(IssueSeverity.Warning, PublishIssueCodes.HeadingOneCount,
                h1s == 0 ? $"“{page.Title}” has no main heading (h1)." : $"“{page.Title}” has {h1s} main headings (h1); use exactly one.",
                path, page.Id, h1s > 1 ? levels.First(l => l.Level == 1).InstanceId : null));
        }

        for (var i = 1; i < levels.Count; i++)
        {
            if (levels[i].Level > levels[i - 1].Level + 1)
            {
                issues.Add(new(IssueSeverity.Warning, PublishIssueCodes.SkippedHeading,
                    $"“{page.Title}” skips from h{levels[i - 1].Level} to h{levels[i].Level}.", path, page.Id, levels[i].InstanceId));
                break;
            }
        }
    }

}

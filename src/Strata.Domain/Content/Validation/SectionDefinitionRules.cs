namespace Strata.Domain.Content.Validation;

/// <summary>
/// Structural rules for a section definition. Drafts may be saved while these fail (designers
/// work incrementally); publishing a version requires that none fail.
/// </summary>
public static class SectionDefinitionRules
{
    public static IReadOnlyList<ContentViolation> Validate(SectionDefinition definition)
    {
        var violations = new List<ContentViolation>();
        var nodeIds = new HashSet<string>(StringComparer.Ordinal);
        var keys = new HashSet<string>(StringComparer.Ordinal);
        var navCount = 0;
        var formCount = 0;

        foreach (var (node, path, repeater) in DefinitionWalker.Walk(definition))
        {
            if (!nodeIds.Add(node.Id))
            {
                violations.Add(new(ViolationCodes.DuplicateNodeId, $"{path}/id", $"Node id '{node.Id}' is used more than once."));
            }

            switch (node)
            {
                case SectionNode when path != "/root":
                    violations.Add(new(ViolationCodes.NestedSection, path, "A section can only be the root of a definition."));
                    break;
                case RepeaterNode r:
                    if (repeater is not null)
                    {
                        violations.Add(new(ViolationCodes.NestedRepeater, path, "Repeaters cannot be nested inside other repeaters."));
                    }

                    if (!keys.Add(r.Key))
                    {
                        violations.Add(new(ViolationCodes.DuplicateSlotKey, $"{path}/key", $"Key '{r.Key}' is used more than once."));
                    }

                    if (r.Min > r.Max)
                    {
                        violations.Add(new(ViolationCodes.RepeaterBounds, path, $"Minimum items ({r.Min}) must not exceed maximum ({r.Max})."));
                    }
                    else if (r.DefaultItemCount < r.Min || r.DefaultItemCount > r.Max)
                    {
                        violations.Add(new(ViolationCodes.RepeaterBounds, $"{path}/defaultItemCount", $"Default item count must be between {r.Min} and {r.Max}."));
                    }

                    break;
                case NavNode:
                    navCount++;
                    if (navCount > 1)
                    {
                        violations.Add(new(ViolationCodes.MultipleNav, path, "A section can contain at most one navigation."));
                    }

                    if (repeater is not null)
                    {
                        violations.Add(new(ViolationCodes.NavInRepeater, path, "Navigation cannot be placed inside a repeater."));
                    }

                    break;
                case ContactFormNode:
                    formCount++;
                    if (formCount > 1)
                    {
                        violations.Add(new(ViolationCodes.MultipleContactForms, path, "A section can contain at most one contact form."));
                    }

                    if (repeater is not null)
                    {
                        violations.Add(new(ViolationCodes.ContactFormInRepeater, path, "A contact form cannot be placed inside a repeater."));
                    }

                    break;
                case ColumnsNode columns when ColumnRatios.PartsOf(columns.Ratio).Count != columns.Columns.Count:
                    violations.Add(new(ViolationCodes.ColumnRatioMismatch, $"{path}/ratio", $"Ratio does not match the number of columns ({columns.Columns.Count})."));
                    break;
            }

            foreach (var slot in node.OwnSlots())
            {
                var slotPath = $"{path}/{SlotPropertyName(node, slot)}";
                if (!keys.Add(slot.Key))
                {
                    violations.Add(new(ViolationCodes.DuplicateSlotKey, $"{slotPath}/key", $"Slot key '{slot.Key}' is used more than once."));
                }

                violations.AddRange(ValidateDefault(slot, slotPath));
            }
        }

        return violations;
    }

    private static IEnumerable<ContentViolation> ValidateDefault(SlotDefinition slot, string path)
    {
        switch (slot)
        {
            case ImageSlotDefinition image when string.IsNullOrWhiteSpace(image.Default.Alt) && !image.Required:
                yield return new(ViolationCodes.ImageAltMissing, $"{path}/default/alt", $"Image slot '{slot.Key}' needs default alt text or must be marked required.");
                break;
            case LinkSlotDefinition { Default.Target: PageLinkTarget }:
                yield return new(ViolationCodes.DefaultPageLink, $"{path}/default", "A section default cannot link to a page; use a URL or leave it empty.");
                break;
            case TextSlotDefinition { MaxLength: { } max } text when text.Default.Text.Length > max:
                yield return new(ViolationCodes.DefaultTooLong, $"{path}/default", $"Default text is longer than the maximum of {max} characters.");
                break;
            case RichTextSlotDefinition { MaxLength: { } max } rich when RichTextMetrics.VisibleLength(rich.Default.Html) > max:
                yield return new(ViolationCodes.DefaultTooLong, $"{path}/default", $"Default text is longer than the maximum of {max} characters.");
                break;
        }
    }

    private static string SlotPropertyName(Node node, SlotDefinition slot) => node switch
    {
        SectionNode => "backgroundImage",
        HeadingNode => "text",
        RichTextNode => "content",
        ImageNode => "image",
        ButtonNode b => ReferenceEquals(slot, b.Label) ? "label" : "link",
        ContactFormNode f => ReferenceEquals(slot, f.SubmitLabel) ? "submitLabel" : "successMessage",
        _ => slot.Key,
    };
}

public static class ColumnRatios
{
    public static IReadOnlyList<int> PartsOf(ColumnRatio ratio) => ratio switch
    {
        ColumnRatio.One => [1],
        ColumnRatio.Half => [1, 1],
        ColumnRatio.OneTwo => [1, 2],
        ColumnRatio.TwoOne => [2, 1],
        ColumnRatio.OneThree => [1, 3],
        ColumnRatio.ThreeOne => [3, 1],
        ColumnRatio.Thirds => [1, 1, 1],
        ColumnRatio.OneTwoOne => [1, 2, 1],
        ColumnRatio.TwoOneOne => [2, 1, 1],
        ColumnRatio.OneOneTwo => [1, 1, 2],
        ColumnRatio.Quarters => [1, 1, 1, 1],
        _ => throw new ArgumentOutOfRangeException(nameof(ratio), ratio, null),
    };
}

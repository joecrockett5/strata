namespace Strata.Domain.Content.Validation;

/// <summary>
/// Semantic validation of a site document (site drafts and starter templates) after it has passed
/// JSON Schema validation. Enforces slot locks (locking rule 1) for every author.
/// </summary>
public static class SiteDocumentValidator
{
    public static IReadOnlyList<ContentViolation> Validate(SiteDocument document, ContentValidationContext context)
    {
        var violations = new List<ContentViolation>();

        ValidatePages(document, violations);
        ValidateMedia(document.Settings.Logo, "/settings/logo", context, violations);

        var instanceIds = new HashSet<Guid>();
        foreach (var (instance, _, path) in document.AllInstances())
        {
            if (!instanceIds.Add(instance.Id))
            {
                violations.Add(new(ViolationCodes.DuplicateId, $"{path}/id", "Section instance ids must be unique within a site."));
            }

            ValidateInstance(instance, path, context, violations);
        }

        return violations;
    }

    private static void ValidatePages(SiteDocument document, List<ContentViolation> violations)
    {
        var pageIds = new HashSet<Guid>();
        var slugs = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < document.Pages.Count; i++)
        {
            var page = document.Pages[i];
            if (!pageIds.Add(page.Id))
            {
                violations.Add(new(ViolationCodes.DuplicateId, $"/pages/{i}/id", "Page ids must be unique."));
            }

            if (!slugs.Add(page.Slug))
            {
                violations.Add(new(ViolationCodes.DuplicateSlug, $"/pages/{i}/slug",
                    page.IsHome ? "Only one page can be the home page." : $"Another page already uses the slug '{page.Slug}'."));
            }
        }

        if (!slugs.Contains(string.Empty))
        {
            violations.Add(new(ViolationCodes.HomePage, "/pages", "Exactly one page must be the home page (empty slug)."));
        }
    }

    private static void ValidateInstance(
        SectionInstance instance,
        string path,
        ContentValidationContext context,
        List<ContentViolation> violations)
    {
        if (!context.Sections.TryGetValue(instance.VersionRef, out var section))
        {
            violations.Add(new(ViolationCodes.SectionVersionNotFound, $"{path}/version",
                $"Section type version {instance.VersionRef} does not exist or is not published."));
            return;
        }

        var catalog = section.Catalog;
        ValidateValues(instance.Values, catalog.Slots, $"{path}/values", context, violations);

        var itemIds = new HashSet<Guid>();
        foreach (var (key, items) in instance.Repeaters)
        {
            var repeaterPath = $"{path}/repeaters/{key}";
            if (!catalog.Repeaters.TryGetValue(key, out var repeater))
            {
                violations.Add(new(ViolationCodes.UnknownRepeater, repeaterPath, $"Section has no repeater '{key}'."));
                continue;
            }

            if (items.Count < repeater.Node.Min || items.Count > repeater.Node.Max)
            {
                violations.Add(new(ViolationCodes.RepeaterItemCount, repeaterPath,
                    $"'{repeater.Node.ItemLabel}' needs between {repeater.Node.Min} and {repeater.Node.Max} items; got {items.Count}."));
            }

            for (var i = 0; i < items.Count; i++)
            {
                if (!itemIds.Add(items[i].Id))
                {
                    violations.Add(new(ViolationCodes.DuplicateId, $"{repeaterPath}/{i}/id", "Repeater item ids must be unique."));
                }

                ValidateValues(items[i].Values, repeater.Slots, $"{repeaterPath}/{i}/values", context, violations);
            }
        }
    }

    private static void ValidateValues(
        IReadOnlyDictionary<string, SlotValue> values,
        IReadOnlyDictionary<string, SlotDefinition> slots,
        string path,
        ContentValidationContext context,
        List<ContentViolation> violations)
    {
        foreach (var (key, value) in values)
        {
            var valuePath = $"{path}/{key}";
            if (!slots.TryGetValue(key, out var slot))
            {
                violations.Add(new(ViolationCodes.UnknownSlot, valuePath, $"Section has no slot '{key}' here."));
                continue;
            }

            // Locking rule 1: locked slots always render the designer's value and store nothing.
            if (slot.IsLocked)
            {
                violations.Add(new(ViolationCodes.SlotLocked, valuePath, $"'{slot.Label}' is locked and cannot be changed."));
                continue;
            }

            if (value.Type != slot.Type)
            {
                violations.Add(new(ViolationCodes.SlotTypeMismatch, valuePath, $"'{slot.Label}' expects a {slot.Type} value, not {value.Type}."));
                continue;
            }

            switch (slot, value)
            {
                case (TextSlotDefinition { MaxLength: { } max }, TextValue text) when text.Text.Length > max:
                    violations.Add(new(ViolationCodes.SlotTooLong, valuePath, $"'{slot.Label}' must be at most {max} characters."));
                    break;
                case (RichTextSlotDefinition { MaxLength: { } max }, RichTextValue rich) when RichTextMetrics.VisibleLength(rich.Html) > max:
                    violations.Add(new(ViolationCodes.SlotTooLong, valuePath, $"'{slot.Label}' must be at most {max} characters."));
                    break;
                case (_, ImageValue image):
                    ValidateMedia(image, valuePath, context, violations);
                    break;
                case (_, LinkValue { Target: UrlLinkTarget url }) when !UrlLinkTarget.IsAllowed(url.Url):
                    violations.Add(new(ViolationCodes.DisallowedUrl, $"{valuePath}/target/url", "Links may only use http(s), mailto or tel."));
                    break;
            }
        }
    }

    private static void ValidateMedia(ImageValue? image, string path, ContentValidationContext context, List<ContentViolation> violations)
    {
        if (image?.MediaId is { } mediaId && !context.UsableMedia.Contains(mediaId))
        {
            violations.Add(new(ViolationCodes.MediaNotFound, $"{path}/mediaId", "The referenced image does not exist or is not available to you."));
        }
    }
}

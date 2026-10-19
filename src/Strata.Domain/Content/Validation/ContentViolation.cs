namespace Strata.Domain.Content.Validation;

/// <summary>
/// One reason a content write was rejected. <paramref name="Path"/> is a JSON pointer into the
/// submitted document; <paramref name="Code"/> is stable and machine-readable.
/// </summary>
public sealed record ContentViolation(string Code, string Path, string Message);

/// <summary>Stable violation codes. Clients may switch on these.</summary>
public static class ViolationCodes
{
    public const string SchemaInvalid = "schema.invalid";

    // Section definitions (checked before publishing a version)
    public const string DuplicateNodeId = "definition.duplicateNodeId";
    public const string DuplicateSlotKey = "definition.duplicateSlotKey";
    public const string NestedSection = "definition.nestedSection";
    public const string NestedRepeater = "definition.nestedRepeater";
    public const string RepeaterBounds = "definition.repeaterBounds";
    public const string MultipleNav = "definition.multipleNav";
    public const string NavInRepeater = "definition.navInRepeater";
    public const string MultipleContactForms = "definition.multipleContactForms";
    public const string ContactFormInRepeater = "definition.contactFormInRepeater";
    public const string ColumnRatioMismatch = "definition.columnRatioMismatch";
    public const string ImageAltMissing = "definition.imageAltMissing";
    public const string DefaultPageLink = "definition.defaultPageLink";
    public const string DefaultTooLong = "definition.defaultTooLong";

    // Documents
    public const string DuplicateId = "document.duplicateId";
    public const string DuplicateSlug = "document.duplicateSlug";
    public const string HomePage = "document.homePage";
    public const string SectionVersionNotFound = "section.versionNotFound";
    public const string UnknownSlot = "slot.unknown";
    public const string SlotLocked = "slot.locked";
    public const string SlotTypeMismatch = "slot.typeMismatch";
    public const string SlotTooLong = "slot.tooLong";
    public const string UnknownRepeater = "repeater.unknown";
    public const string RepeaterItemCount = "repeater.itemCount";
    public const string MediaNotFound = "media.notFound";
    public const string DisallowedUrl = "link.disallowedUrl";

    // Locking (owners) and versions
    public const string LockedSectionRemoved = "section.locked.removed";
    public const string LockedSectionModified = "section.locked.modified";
    public const string LockedSectionMoved = "section.locked.moved";
    public const string RequiredSectionRemoved = "section.required.removed";
    public const string RequiredSectionMoved = "section.required.moved";
    public const string LockedOrRequiredHidden = "section.lockedOrRequiredHidden";
    public const string SectionLockChanged = "section.lockChanged";
    public const string ThemeLocksChanged = "theme.locksChanged";
    public const string ThemeTokenLocked = "theme.tokenLocked";
    public const string VersionPinChanged = "version.pinChanged";
    public const string SectionTypeArchived = "version.archived";
}

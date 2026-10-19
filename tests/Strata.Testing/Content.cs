using Strata.Domain.Content;

namespace Strata.Testing;

/// <summary>Terse builders for content used across unit and integration tests.</summary>
public static class Content
{
    public static TextValue Text(string text) => new(text);

    public static RichTextValue Rich(string html) => new(html);

    public static ImageValue Image(Guid? mediaId, string alt) => new(mediaId, alt);

    public static LinkValue Url(string url) => new(new UrlLinkTarget(url));

    public static LinkValue ToPage(Guid pageId) => new(new PageLinkTarget(pageId));

    public static TextSlotDefinition TextSlot(string key, string text = "Default", SlotMode mode = SlotMode.Editable, bool required = false, int? maxLength = null) =>
        new() { Key = key, Label = key, Mode = mode, Required = required, MaxLength = maxLength, Default = Text(text) };

    public static RichTextSlotDefinition RichSlot(string key, string html = "<p>Default</p>", SlotMode mode = SlotMode.Editable, int? maxLength = null) =>
        new() { Key = key, Label = key, Mode = mode, Required = false, MaxLength = maxLength, Default = Rich(html) };

    public static ImageSlotDefinition ImageSlot(string key, string alt = "Default alt", SlotMode mode = SlotMode.Editable, bool required = false) =>
        new() { Key = key, Label = key, Mode = mode, Required = required, Default = Image(null, alt) };

    public static LinkSlotDefinition LinkSlot(string key, SlotMode mode = SlotMode.Editable) =>
        new() { Key = key, Label = key, Mode = mode, Required = false, Default = new LinkValue(null) };

    public static HeadingNode Heading(string id, TextSlotDefinition slot, int level = 2) =>
        new() { Id = id, Level = level, Align = Align.Start, Text = slot };

    public static RichTextNode RichText(string id, RichTextSlotDefinition slot) =>
        new() { Id = id, Align = Align.Start, Content = slot };

    public static ImageNode ImageNode(string id, ImageSlotDefinition slot) =>
        new() { Id = id, Aspect = ImageAspect.Auto, Fit = ImageFit.Cover, Radius = ImageRadius.None, Image = slot };

    public static ButtonNode Button(string id, string labelKey, string linkKey) =>
        new() { Id = id, Variant = ButtonVariant.Primary, Align = Align.Start, Label = TextSlot(labelKey, "Click"), Link = LinkSlot(linkKey) };

    public static RepeaterNode Repeater(string id, string key, int min, int max, params Node[] children) =>
        new() { Id = id, Key = key, ItemLabel = "Item", Min = min, Max = max, DefaultItemCount = min, Layout = RepeaterLayout.Stack, Gap = Spacing.Md, Children = children };

    public static ColumnsNode Columns(string id, params Node[][] columns) => new()
    {
        Id = id,
        Ratio = columns.Length switch { 1 => ColumnRatio.One, 2 => ColumnRatio.Half, 3 => ColumnRatio.Thirds, _ => ColumnRatio.Quarters },
        Gap = Spacing.Md,
        Valign = CrossAlign.Start,
        StackAt = Breakpoint.Tablet,
        Columns = [.. columns.Select(c => new Column(c))],
    };

    public static SectionDefinition Section(params Node[] children) => new()
    {
        Root = new SectionNode { Id = "root", Background = SectionBackground.Background, PaddingY = Spacing.Lg, Width = ContentWidth.Standard, Children = children },
    };

    public static SectionInstance Instance(
        SectionVersionRef version,
        SectionLock lockMode = SectionLock.None,
        IReadOnlyDictionary<string, SlotValue>? values = null,
        IReadOnlyDictionary<string, IReadOnlyList<RepeaterItem>>? repeaters = null) => new()
        {
            Id = Guid.NewGuid(),
            SectionTypeId = version.SectionTypeId,
            Version = version.Version,
            Lock = lockMode,
            Values = values ?? new Dictionary<string, SlotValue>(),
            Repeaters = repeaters ?? new Dictionary<string, IReadOnlyList<RepeaterItem>>(),
        };

    public static RepeaterItem Item(params (string Key, SlotValue Value)[] values) =>
        new(Guid.NewGuid(), values.ToDictionary(v => v.Key, v => v.Value));

    public static Page Page(string title, string slug, params SectionInstance[] sections) =>
        new() { Id = Guid.NewGuid(), Title = title, Slug = slug, Seo = new PageSeo(title, string.Empty), Sections = sections };

    public static SiteDocument Site(params Page[] pages) => new()
    {
        Settings = new SiteSettings { FirmName = "Test Firm", Logo = null },
        Theme = Theme.Default,
        Pages = pages.Length > 0 ? pages : [Page("Home", string.Empty)],
    };

    public static Dictionary<string, SlotValue> Values(params (string Key, SlotValue Value)[] values) =>
        values.ToDictionary(v => v.Key, v => v.Value);

    /// <summary>Replaces the instance with <paramref name="id"/> wherever it lives in the document.</summary>
    public static SiteDocument ReplaceInstance(this SiteDocument document, Guid id, Func<SectionInstance, SectionInstance> change) => document with
    {
        Header = document.Header?.Id == id ? change(document.Header) : document.Header,
        Footer = document.Footer?.Id == id ? change(document.Footer) : document.Footer,
        Pages = [.. document.Pages.Select(p => p with { Sections = [.. p.Sections.Select(s => s.Id == id ? change(s) : s)] })],
    };

    public static SiteDocument MapPage(this SiteDocument document, int index, Func<Page, Page> change) =>
        document with { Pages = [.. document.Pages.Select((p, i) => i == index ? change(p) : p)] };
}

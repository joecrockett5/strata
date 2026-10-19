using Ganss.Xss;
using Strata.Domain.Content;

namespace Strata.Infrastructure.Content;

public interface IRichTextSanitizer
{
    string Sanitize(string html);
}

/// <summary>
/// Allowlist sanitiser for rich-text slots: paragraphs, line breaks, bold, italic, links and lists.
/// Links may only use http(s), mailto or tel. Disallowed elements keep their text content.
/// </summary>
public sealed class RichTextSanitizer : IRichTextSanitizer
{
    private readonly HtmlSanitizer sanitizer;

    public RichTextSanitizer()
    {
        sanitizer = new HtmlSanitizer(new HtmlSanitizerOptions
        {
            AllowedTags = new HashSet<string>(["p", "br", "strong", "em", "a", "ul", "ol", "li"], StringComparer.OrdinalIgnoreCase),
            AllowedAttributes = new HashSet<string>(["href"], StringComparer.OrdinalIgnoreCase),
            AllowedSchemes = new HashSet<string>(["http", "https", "mailto", "tel"], StringComparer.OrdinalIgnoreCase),
            UriAttributes = new HashSet<string>(["href"], StringComparer.OrdinalIgnoreCase),
            AllowedCssProperties = new HashSet<string>(),
            AllowedAtRules = new HashSet<AngleSharp.Css.Dom.CssRuleType>(),
        })
        {
            KeepChildNodes = true,
            AllowDataAttributes = false,
        };

        // KeepChildNodes would turn a removed <script>'s source into visible text; drop such content entirely.
        sanitizer.RemovingTag += (_, e) =>
        {
            if (e.Tag.LocalName is "script" or "style" or "template" or "noscript" or "iframe" or "object" or "textarea" or "title")
            {
                e.Tag.InnerHtml = string.Empty;
            }
        };

        // Relative and protocol-relative URLs have no scheme for the allowlist to check; reject them.
        sanitizer.FilterUrl += (_, e) =>
        {
            if (e.SanitizedUrl is { } url && !UrlLinkTarget.IsAllowed(url))
            {
                e.SanitizedUrl = null;
            }
        };
    }

    public string Sanitize(string html) => sanitizer.Sanitize(html).Trim();
}

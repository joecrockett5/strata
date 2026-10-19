using System.Net;
using System.Text.RegularExpressions;

namespace Strata.Domain.Content;

public static partial class RichTextMetrics
{
    /// <summary>Visible text of sanitised rich-text HTML (tags removed, entities decoded).</summary>
    public static string VisibleText(string html) => WebUtility.HtmlDecode(Tags().Replace(html, string.Empty)).Trim();

    public static int VisibleLength(string html) => VisibleText(html).Length;

    [GeneratedRegex("<[^>]*>")]
    private static partial Regex Tags();
}

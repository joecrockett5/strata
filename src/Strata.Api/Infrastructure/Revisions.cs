using System.Globalization;

namespace Strata.Api.Infrastructure;

/// <summary>Maps draft revisions to strong ETags (<c>"r42"</c>) for optimistic concurrency.</summary>
public static class Revisions
{
    public static string ToETag(long revision) => $"\"r{revision.ToString(CultureInfo.InvariantCulture)}\"";

    /// <summary>Parses the If-Match header; returns null when it is absent or malformed.</summary>
    public static long? FromIfMatch(HttpRequest request)
    {
        var header = request.Headers.IfMatch.ToString().Trim();
        if (header.StartsWith("W/", StringComparison.Ordinal))
        {
            header = header[2..];
        }

        header = header.Trim('"');
        if (header.StartsWith('r'))
        {
            header = header[1..];
        }

        return long.TryParse(header, NumberStyles.None, CultureInfo.InvariantCulture, out var revision) ? revision : null;
    }

    public static void SetETag(HttpResponse response, long revision) => response.Headers.ETag = ToETag(revision);
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Strata.Domain.Content;

namespace Strata.Infrastructure.Persistence;

internal static class ContentJsonbExtensions
{
    /// <summary>
    /// Stores a content record as <c>jsonb</c> using <see cref="ContentJson"/> — the same serializer
    /// the API validates against the schema — so stored JSON always matches the content schema.
    /// </summary>
    public static PropertyBuilder<T> HasContentJson<T>(this PropertyBuilder<T> property)
        where T : class
    {
        var comparer = new ValueComparer<T>(
            (left, right) => ContentJson.Serialize(left) == ContentJson.Serialize(right),
            value => ContentJson.Serialize(value).GetHashCode(StringComparison.Ordinal),
            value => ContentJson.Deserialize<T>(ContentJson.Serialize(value)));

        return property
            .HasConversion(value => ContentJson.Serialize(value), json => ContentJson.Deserialize<T>(json), comparer)
            .HasColumnType("jsonb");
    }
}

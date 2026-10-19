using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace Strata.Domain.Content;

/// <summary>The one set of serializer options for content documents (matches the JSON Schema).</summary>
public static class ContentJson
{
    public static JsonSerializerOptions Options { get; } = CreateOptions();

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            // Clients may send "$type" anywhere in an object, not only first.
            AllowOutOfOrderMetadataProperties = true,
            RespectNullableAnnotations = true,
            RespectRequiredConstructorParameters = true,
            WriteIndented = false,
            TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { SerializeThroughPolymorphicBase } },
        };
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
        options.MakeReadOnly(populateMissingResolver: true);
        return options;
    }

    /// <summary>Bases whose subtypes are tagged with a discriminator in the content schema.</summary>
    private static readonly Type[] PolymorphicBases = [typeof(Node), typeof(SlotValue), typeof(LinkTarget)];

    /// <summary>
    /// System.Text.Json only writes the <c>$type</c> discriminator when the declared type is the
    /// polymorphic base. Content records declare concrete subtypes for strong typing
    /// (e.g. <c>SectionDefinition.Root : SectionNode</c>, <c>TextSlotDefinition.Default : TextValue</c>),
    /// yet the schema requires the discriminator everywhere. This modifier routes such properties
    /// through their base type so the tag is always written and checked on read.
    /// </summary>
    private static void SerializeThroughPolymorphicBase(JsonTypeInfo typeInfo)
    {
        if (typeInfo.Kind != JsonTypeInfoKind.Object)
        {
            return;
        }

        for (var i = 0; i < typeInfo.Properties.Count; i++)
        {
            var original = typeInfo.Properties[i];
            var declared = original.PropertyType;
            var baseType = PolymorphicBases.FirstOrDefault(b => b != declared && b.IsAssignableFrom(declared));
            if (baseType is null)
            {
                continue;
            }

            var replacement = typeInfo.CreateJsonPropertyInfo(baseType, original.Name);
            replacement.Get = original.Get;
            replacement.IsRequired = original.IsRequired;
            replacement.Order = original.Order;
            replacement.ShouldSerialize = original.ShouldSerialize;
            replacement.AttributeProvider = original.AttributeProvider;
            if (original.Set is { } set)
            {
                replacement.Set = (target, value) =>
                {
                    if (value is not null && !declared.IsInstanceOfType(value))
                    {
                        throw new JsonException($"Property '{original.Name}' expects {declared.Name}, not {value.GetType().Name}.");
                    }

                    set(target, value);
                };
            }

            typeInfo.Properties[i] = replacement;
        }
    }

    public static T Deserialize<T>(JsonElement element) =>
        element.Deserialize<T>(Options) ?? throw new JsonException($"Expected a {typeof(T).Name}, got null.");

    public static T Deserialize<T>(string json) =>
        JsonSerializer.Deserialize<T>(json, Options) ?? throw new JsonException($"Expected a {typeof(T).Name}, got null.");

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);

    public static JsonElement ToElement<T>(T value) => JsonSerializer.SerializeToElement(value, Options);

    /// <summary>Structural equality of two content values, independent of record/collection identity.</summary>
    public static bool StructurallyEqual<T>(T left, T right) =>
        JsonNode.DeepEquals(JsonSerializer.SerializeToNode(left, Options), JsonSerializer.SerializeToNode(right, Options));
}

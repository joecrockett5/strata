using System.Buffers.Binary;

namespace Strata.Infrastructure.Storage;

public sealed record ImageInfo(string ContentType, string Extension, int Width, int Height);

/// <summary>
/// Identifies JPEG, PNG and WebP files from their bytes (never the file name or the client's
/// content type) and reads their dimensions from the header. Everything else — including SVG,
/// which can carry script — is rejected.
/// </summary>
public static class ImageInspector
{
    public static ImageInfo? Inspect(ReadOnlySpan<byte> data)
    {
        if (data.Length >= 24 && data[..8].SequenceEqual(PngSignature))
        {
            return Dimensions(BinaryPrimitives.ReadInt32BigEndian(data[16..]), BinaryPrimitives.ReadInt32BigEndian(data[20..]), "image/png", ".png");
        }

        if (data.Length >= 4 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
        {
            return InspectJpeg(data);
        }

        if (data.Length >= 30 && data[..4].SequenceEqual("RIFF"u8) && data[8..12].SequenceEqual("WEBP"u8))
        {
            return InspectWebP(data);
        }

        return null;
    }

    private static ReadOnlySpan<byte> PngSignature => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static ImageInfo? InspectJpeg(ReadOnlySpan<byte> data)
    {
        var i = 2;
        while (i + 9 < data.Length)
        {
            if (data[i] != 0xFF)
            {
                return null;
            }

            var marker = data[i + 1];
            if (marker == 0xFF)
            {
                i++;
                continue;
            }

            var length = BinaryPrimitives.ReadUInt16BigEndian(data[(i + 2)..]);
            var isStartOfFrame = marker is >= 0xC0 and <= 0xCF && marker is not (0xC4 or 0xC8 or 0xCC);
            if (isStartOfFrame)
            {
                var height = BinaryPrimitives.ReadUInt16BigEndian(data[(i + 5)..]);
                var width = BinaryPrimitives.ReadUInt16BigEndian(data[(i + 7)..]);
                return Dimensions(width, height, "image/jpeg", ".jpg");
            }

            i += 2 + length;
        }

        return null;
    }

    private static ImageInfo? InspectWebP(ReadOnlySpan<byte> data)
    {
        var chunk = data[12..16];
        if (chunk.SequenceEqual("VP8 "u8))
        {
            // Lossy: 14-bit dimensions after the 3-byte frame tag and 3-byte start code.
            var width = BinaryPrimitives.ReadUInt16LittleEndian(data[26..]) & 0x3FFF;
            var height = BinaryPrimitives.ReadUInt16LittleEndian(data[28..]) & 0x3FFF;
            return Dimensions(width, height, "image/webp", ".webp");
        }

        if (chunk.SequenceEqual("VP8L"u8) && data[20] == 0x2F)
        {
            var bits = BinaryPrimitives.ReadUInt32LittleEndian(data[21..]);
            return Dimensions((int)(bits & 0x3FFF) + 1, (int)((bits >> 14) & 0x3FFF) + 1, "image/webp", ".webp");
        }

        if (chunk.SequenceEqual("VP8X"u8))
        {
            var width = (data[24] | (data[25] << 8) | (data[26] << 16)) + 1;
            var height = (data[27] | (data[28] << 8) | (data[29] << 16)) + 1;
            return Dimensions(width, height, "image/webp", ".webp");
        }

        return null;
    }

    private static ImageInfo? Dimensions(int width, int height, string contentType, string extension) =>
        width is > 0 and <= 20000 && height is > 0 and <= 20000 ? new ImageInfo(contentType, extension, width, height) : null;
}

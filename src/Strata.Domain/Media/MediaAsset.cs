namespace Strata.Domain.Media;

/// <summary>An uploaded raster image. Files live behind IFileStorage; this row holds the metadata.</summary>
public sealed class MediaAsset
{
    public const long MaxBytes = 5 * 1024 * 1024;

    private MediaAsset()
    {
    }

    public Guid Id { get; private set; }
    public Guid OwnerId { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long ByteSize { get; private set; }
    public int Width { get; private set; }
    public int Height { get; private set; }
    public string StorageKey { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }

    public static MediaAsset Create(Guid ownerId, string fileName, string contentType, long byteSize, int width, int height, string storageKey, DateTimeOffset now) => new()
    {
        Id = Guid.CreateVersion7(now),
        OwnerId = ownerId,
        FileName = fileName,
        ContentType = contentType,
        ByteSize = byteSize,
        Width = width,
        Height = height,
        StorageKey = storageKey,
        CreatedAt = now,
    };
}

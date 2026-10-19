using Microsoft.Extensions.Options;
using Strata.Domain.Media;

namespace Strata.Infrastructure.Storage;

public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>Directory for uploaded files (a Docker volume in compose). Relative paths resolve against the content root.</summary>
    public string RootPath { get; set; } = ".data/media";
}

/// <summary>Stores files on local disk under random names, sharded by the first two characters.</summary>
public sealed class LocalFileStorage(IOptions<StorageOptions> options) : IFileStorage
{
    private readonly string root = Path.GetFullPath(options.Value.RootPath);

    public async Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken)
    {
        var key = $"{Guid.NewGuid():N}{extension}";
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await content.CopyToAsync(file, cancellationToken);
        return key;
    }

    public Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken)
    {
        var path = PathFor(key);
        Stream? stream = File.Exists(path)
            ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true)
            : null;
        return Task.FromResult(stream);
    }

    private string PathFor(string key)
    {
        // Keys come from SaveAsync; still refuse anything that could escape the root.
        if (key.Length < 3 || key.Any(c => !(char.IsAsciiLetterOrDigit(c) || c == '.')) || key.Contains("..", StringComparison.Ordinal))
        {
            throw new ArgumentException("Invalid storage key.", nameof(key));
        }

        return Path.Combine(root, key[..2], key);
    }
}

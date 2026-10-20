namespace Strata.Domain.Sites;

/// <summary>
/// A message sent through a published contact form. Personal data: it is stored for the site
/// owner and never logged.
/// </summary>
public sealed class ContactSubmission
{
    private ContactSubmission()
    {
    }

    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid PublishedVersionId { get; private set; }
    public Guid PageId { get; private set; }
    public Guid SectionInstanceId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string? Phone { get; private set; }
    public string Message { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }

    public static ContactSubmission Create(
        Guid siteId, Guid publishedVersionId, Guid pageId, Guid sectionInstanceId,
        string name, string email, string? phone, string message, DateTimeOffset now) => new()
        {
            Id = Guid.CreateVersion7(now),
            SiteId = siteId,
            PublishedVersionId = publishedVersionId,
            PageId = pageId,
            SectionInstanceId = sectionInstanceId,
            Name = name,
            Email = email,
            Phone = phone,
            Message = message,
            CreatedAt = now,
        };
}

using Strata.Infrastructure.Content;

namespace Strata.Infrastructure.Tests;

public sealed class RichTextSanitizerTests
{
    private readonly RichTextSanitizer sanitizer = new();

    [Fact]
    public void Keeps_the_allowed_formatting()
    {
        const string html = "<p><strong>Bold</strong>, <em>italic</em> and <a href=\"https://example.com\">a link</a>.</p><ul><li>One</li></ul><ol><li>Two</li></ol>";

        sanitizer.Sanitize(html).ShouldBe(html);
    }

    [Theory]
    [InlineData("<p>Hi<script>alert(1)</script></p>", "<p>Hi</p>")]
    [InlineData("<p onclick=\"x()\">Hi</p>", "<p>Hi</p>")]
    [InlineData("<p style=\"color:red\">Hi</p>", "<p>Hi</p>")]
    [InlineData("<h1>Title</h1>", "Title")]
    [InlineData("<p><img src=x onerror=alert(1)>Hi</p>", "<p>Hi</p>")]
    [InlineData("<a href=\"javascript:alert(1)\">x</a>", "<a>x</a>")]
    [InlineData("<a href=\"/relative\">x</a>", "<a>x</a>")]
    [InlineData("<a href=\"https://x.test\" target=\"_blank\">x</a>", "<a href=\"https://x.test\">x</a>")]
    public void Removes_everything_outside_the_allowlist(string input, string expected)
    {
        sanitizer.Sanitize(input).ShouldBe(expected);
    }

    [Theory]
    [InlineData("mailto:team@example.com")]
    [InlineData("tel:+15551234567")]
    [InlineData("http://example.com")]
    public void Allows_http_mailto_and_tel_links(string href)
    {
        sanitizer.Sanitize($"<a href=\"{href}\">x</a>").ShouldBe($"<a href=\"{href}\">x</a>");
    }

    [Fact]
    public void Sanitising_is_idempotent()
    {
        var once = sanitizer.Sanitize("<p>A &amp; B <b>bold</b><br>next</p>");

        sanitizer.Sanitize(once).ShouldBe(once);
    }
}

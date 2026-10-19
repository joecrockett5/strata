namespace Strata.Rendering.Tests;

public sealed class NormalizerTests
{
    [Theory]
    [InlineData("<a class=\"b a\" href=\"x\">Hi</a>", "<a href='x' class='a b'>Hi</a>")]
    [InlineData("<input required=\"\">", "<input required>")]
    [InlineData("<div style=\"--b: 2; --a:1\"></div>", "<div style=\"--a:1;--b:2;\"></div>")]
    [InlineData("<p>A &amp; B</p>", "<p>A &#38; B</p>")]
    [InlineData("<div>\n  <p>\n    Hello   world\n  </p>\n</div>", "<div><p>Hello world</p></div>")]
    public void Treats_equivalent_markup_as_equal(string left, string right)
    {
        HtmlNormalizer.Normalize(left).ShouldBe(HtmlNormalizer.Normalize(right));
    }

    [Theory]
    [InlineData("<h2>Title</h2>", "<h3>Title</h3>")]
    [InlineData("<a href=\"/a\">x</a>", "<a href=\"/b\">x</a>")]
    [InlineData("<div class=\"st-a\"></div>", "<div class=\"st-a st-b\"></div>")]
    [InlineData("<p>Hello world</p>", "<p>Hello</p>")]
    [InlineData("<div><p>a</p></div>", "<div></div><p>a</p>")]
    public void Keeps_meaningful_differences(string left, string right)
    {
        HtmlNormalizer.Normalize(left).ShouldNotBe(HtmlNormalizer.Normalize(right));
    }
}

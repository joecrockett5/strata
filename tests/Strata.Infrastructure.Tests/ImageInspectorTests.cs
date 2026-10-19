using System.Text;
using Strata.Infrastructure.Storage;

namespace Strata.Infrastructure.Tests;

public sealed class ImageInspectorTests
{
    [Fact]
    public void Recognises_png_and_reads_dimensions()
    {
        var png = PngWriter.Encode(12, 7, (_, _) => (10, 20, 30));

        ImageInspector.Inspect(png).ShouldBe(new ImageInfo("image/png", ".png", 12, 7));
    }

    [Fact]
    public void Recognises_jpeg_from_its_start_of_frame_marker()
    {
        byte[] jpeg =
        [
            0xFF, 0xD8, // SOI
            0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00, // APP0, length 4
            0xFF, 0xC0, 0x00, 0x11, 0x08, 0x01, 0x2C, 0x02, 0x58, 0x03, // SOF0: 300 x 600
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ];

        ImageInspector.Inspect(jpeg).ShouldBe(new ImageInfo("image/jpeg", ".jpg", 600, 300));
    }

    [Fact]
    public void Recognises_lossless_webp()
    {
        var bytes = new byte[32];
        Encoding.ASCII.GetBytes("RIFF").CopyTo(bytes, 0);
        Encoding.ASCII.GetBytes("WEBP").CopyTo(bytes, 8);
        Encoding.ASCII.GetBytes("VP8L").CopyTo(bytes, 12);
        bytes[20] = 0x2F;
        // width-1 = 99 (14 bits), height-1 = 49 (next 14 bits)
        var bits = 99u | (49u << 14);
        BitConverter.GetBytes(bits).CopyTo(bytes, 21);

        ImageInspector.Inspect(bytes).ShouldBe(new ImageInfo("image/webp", ".webp", 100, 50));
    }

    [Theory]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>")]
    [InlineData("GIF89a..........................")]
    [InlineData("just some text that is long enough")]
    public void Rejects_everything_else(string content)
    {
        ImageInspector.Inspect(Encoding.UTF8.GetBytes(content)).ShouldBeNull();
    }

    [Fact]
    public void Rejects_truncated_png()
    {
        var png = PngWriter.Encode(4, 4, (_, _) => (0, 0, 0));

        ImageInspector.Inspect(png.AsSpan(0, 12)).ShouldBeNull();
    }
}

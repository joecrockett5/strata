using Strata.Infrastructure.Storage;

namespace Strata.Infrastructure.Seeding.Demo;

/// <summary>
/// Placeholder artwork drawn at seed time (no stock photos, nothing hotlinked): a harbour at dawn,
/// pine-covered hills, abstract portraits and a simple logo mark.
/// </summary>
internal static class PlaceholderImages
{
    private readonly record struct Rgb(double R, double G, double B)
    {
        public static Rgb Hex(string hex) => new(Convert.ToInt32(hex[1..3], 16), Convert.ToInt32(hex[3..5], 16), Convert.ToInt32(hex[5..7], 16));

        public Rgb Mix(Rgb other, double t)
        {
            t = Math.Clamp(t, 0, 1);
            return new(R + ((other.R - R) * t), G + ((other.G - G) * t), B + ((other.B - B) * t));
        }

        public (byte, byte, byte) Bytes() => ((byte)Math.Clamp(R, 0, 255), (byte)Math.Clamp(G, 0, 255), (byte)Math.Clamp(B, 0, 255));
    }

    public static byte[] Harbour(int width = 1600, int height = 900)
    {
        Rgb skyTop = Rgb.Hex("#16384d"), skyLow = Rgb.Hex("#e7b77a"), waterTop = Rgb.Hex("#2c5f7a"), waterLow = Rgb.Hex("#0d2534"), hill = Rgb.Hex("#1f3f3a");
        var horizon = height * 0.62;
        return PngWriter.Encode(width, height, (x, y) =>
        {
            var hillLine = horizon - (height * 0.08 * (0.6 + (0.4 * Math.Sin(x / (double)width * 5.1)))) - (height * 0.03 * Math.Sin(x / 37.0));
            if (y < horizon)
            {
                var sky = skyTop.Mix(skyLow, Math.Pow(y / horizon, 2.2));
                return (y > hillLine ? hill.Mix(sky, 0.15) : sky).Bytes();
            }

            var depth = (y - horizon) / (height - horizon);
            var water = waterTop.Mix(waterLow, depth);
            var ripple = Math.Sin((x * 0.045) + (y * 0.35)) * Math.Sin(y * 0.9);
            return water.Mix(skyLow, ripple > 0.85 ? 0.35 * (1 - depth) : 0).Bytes();
        });
    }

    public static byte[] Hills(int width = 1200, int height = 900)
    {
        Rgb sky = Rgb.Hex("#dfe9e4"), far = Rgb.Hex("#7c9a8d"), mid = Rgb.Hex("#3f6b5a"), near = Rgb.Hex("#1f3f33");
        return PngWriter.Encode(width, height, (x, y) =>
        {
            var u = x / (double)width;
            double Ridge(double baseLine, double amplitude, double frequency, double phase) =>
                height * (baseLine + (amplitude * Math.Sin((u * frequency) + phase))) + (Math.Abs(Math.Sin(x * 0.21 + phase)) * height * 0.012);
            if (y > Ridge(0.72, 0.05, 7, 1.3)) return near.Mix(Rgb.Hex("#14291f"), (y / (double)height) - 0.7).Bytes();
            if (y > Ridge(0.55, 0.06, 5, 0.2)) return mid.Bytes();
            if (y > Ridge(0.42, 0.05, 3.3, 2.1)) return far.Bytes();
            return sky.Mix(Rgb.Hex("#f5efe2"), y / (height * 0.45)).Bytes();
        });
    }

    /// <summary>An abstract portrait silhouette; <paramref name="variant"/> picks the palette.</summary>
    public static byte[] Portrait(int variant, int size = 600)
    {
        var palettes = new[]
        {
            (Bg: Rgb.Hex("#cfe0e8"), Figure: Rgb.Hex("#16384d"), Face: Rgb.Hex("#d9b49a")),
            (Bg: Rgb.Hex("#e4ddc8"), Figure: Rgb.Hex("#2f5d50"), Face: Rgb.Hex("#8d5a3b")),
            (Bg: Rgb.Hex("#e9d8d4"), Figure: Rgb.Hex("#5b4b6e"), Face: Rgb.Hex("#c08b62")),
        };
        var (bg, figure, face) = palettes[variant % palettes.Length];
        double cx = size / 2.0, headY = size * 0.4, headR = size * 0.17;
        return PngWriter.Encode(size, size, (x, y) =>
        {
            var dx = x - cx;
            var head = (dx * dx) + ((y - headY) * (y - headY)) < headR * headR;
            var shouldersY = size * 0.95;
            var shoulders = y > size * 0.62 && ((dx * dx) / (size * size * 0.13)) + (((y - shouldersY) * (y - shouldersY)) / (size * size * 0.11)) < 1;
            if (head) return face.Bytes();
            if (shoulders) return figure.Bytes();
            return bg.Mix(Rgb.Hex("#ffffff"), 0.25 * (1 - (y / (double)size))).Bytes();
        });
    }

    /// <summary>A round mark: pine-green hill over harbour waves, on white.</summary>
    public static byte[] Logo(int size = 240)
    {
        Rgb navy = Rgb.Hex("#16384d"), pine = Rgb.Hex("#2f5d50"), gold = Rgb.Hex("#c2893b"), white = Rgb.Hex("#ffffff");
        double c = size / 2.0, r = size * 0.46;
        return PngWriter.Encode(size, size, (x, y) =>
        {
            double dx = x - c, dy = y - c;
            if ((dx * dx) + (dy * dy) > r * r) return white.Bytes();
            var wave = c + (size * 0.08) + (Math.Sin(x / (size / 9.0)) * size * 0.02);
            if (y > wave && ((int)((y - wave) / (size * 0.06)) % 2 == 0)) return gold.Bytes();
            if (y > wave) return navy.Bytes();
            var peak = c - (size * 0.25) + (Math.Abs(dx) * 1.3);
            return y > peak ? pine.Bytes() : navy.Mix(white, 0.12).Bytes();
        });
    }
}

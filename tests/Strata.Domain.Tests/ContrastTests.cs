using System.Text.Json;
using Strata.Domain.Publishing;
using Strata.Testing;

namespace Strata.Domain.Tests;

public sealed class ContrastTests
{
    public static TheoryData<string, string, double, bool> Vectors()
    {
        using var json = JsonDocument.Parse(File.ReadAllText(RepoPaths.Fixture("contrast.json")));
        var data = new TheoryData<string, string, double, bool>();
        foreach (var v in json.RootElement.GetProperty("vectors").EnumerateArray())
        {
            data.Add(v.GetProperty("foreground").GetString()!, v.GetProperty("background").GetString()!, v.GetProperty("ratio").GetDouble(), v.GetProperty("passesAA").GetBoolean());
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Vectors))]
    public void Matches_the_shared_vectors(string foreground, string background, double ratio, bool passesAa)
    {
        var actual = Contrast.Ratio(foreground, background);

        Math.Round(actual, 2).ShouldBe(ratio);
        (actual >= Contrast.AaNormalText).ShouldBe(passesAa);
        Contrast.Ratio(background, foreground).ShouldBe(actual, 1e-12);
    }
}

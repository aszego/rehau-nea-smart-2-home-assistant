using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Rehau.TokenHelper;

internal static class SelfTests
{
    internal static async Task<int> RunAsync()
    {
        var session = OAuthSession.Create();
        var query = OAuthSession.ParseQuery(session.AuthorizationUrl);
        Check(session.AuthorizationUrl.Host == "accounts.rehau.com", "Authorization host");
        Check(query["redirect_uri"][0] == OAuthSession.RedirectUri, "Redirect URI");
        Check(query["scope"][0].Contains("offline_access"), "Offline access scope");
        var challenge = Convert.ToBase64String(SHA256.HashData(Encoding.ASCII.GetBytes(session.Verifier))).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        Check(query["code_challenge"][0] == challenge && query["code_challenge_method"][0] == "S256", "PKCE challenge");
        Check(session.Verifier.Length == 43 && OAuthSession.Create().Verifier != session.Verifier, "Random verifier");
        var redirect = $"{OAuthSession.RedirectUri}?code=test%2Bcode&state={session.State}";
        Check(session.ExtractCode(redirect) == "test+code", "Redirect decoding");
        Reject(() => session.ExtractCode("code-only"), "Bare code rejection");
        Reject(() => session.ExtractCode("https://example.com/?code=secret"), "Wrong redirect rejection");
        Reject(() => session.ExtractCode($"{OAuthSession.RedirectUri}?code=secret"), "Missing state rejection");
        Reject(() => session.ExtractCode(redirect.Replace(session.State, OAuthSession.Create().State)), "Wrong state rejection");
        Reject(() => session.ExtractCode(redirect + "&code=duplicate"), "Duplicate code rejection");
        Reject(() => session.ExtractCode(redirect + "&error=access_denied"), "Denied authorization rejection");
        using var handler = new StubHandler(async request =>
        {
            Check(request.Method == HttpMethod.Post && request.RequestUri?.AbsoluteUri == OAuthSession.TokenUrl, "Token endpoint");
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync());
            Check(body.RootElement.GetProperty("code_verifier").GetString() == session.Verifier, "Verifier exchange");
            Check(body.RootElement.GetProperty("code").GetString() == "test-code", "Code exchange");
            Check(body.RootElement.GetProperty("grant_type").GetString() == "authorization_code", "Grant type");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"access_token\":\"access\",\"refresh_token\":\"refresh\"}") };
        });
        using var client = new HttpClient(handler);
        Check(await session.ExchangeAsync(client, "test-code", default) == new TokenPair("access", "refresh"), "Token pair");
        foreach (var payload in new[] { "null", "{}", "{\"access_token\":\"a\"}", "{\"access_token\":\"a\",\"refresh_token\":\" \"}", "not JSON" })
        {
            using var invalid = new HttpClient(new StubHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(payload) })));
            try { await session.ExchangeAsync(invalid, "code", default); throw new Exception("Invalid response accepted"); }
            catch (Exception error) when (error is InvalidOperationException or JsonException) { }
        }
        using var rejected = new HttpClient(new StubHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden) { Content = new StringContent("SECRET") })));
        try { await session.ExchangeAsync(rejected, "SECRET", default); throw new Exception("HTTP rejection accepted"); }
        catch (InvalidOperationException error) { Check(error.Message.Contains("HTTP 403") && !error.Message.Contains("SECRET"), "Sanitized HTTP error"); }
        Console.WriteLine("All offline helper checks passed. No live REHAU request was made.");
        return 0;
    }

    private static void Check(bool condition, string name)
    {
        if (!condition) throw new Exception($"Self-test failed: {name}");
        Console.WriteLine($"PASS: {name}");
    }

    private static void Reject(Action action, string name)
    {
        try { action(); }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException) { Console.WriteLine($"PASS: {name}"); return; }
        throw new Exception($"Self-test failed: {name}");
    }

    private sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => response(request);
    }
}

using System.Diagnostics;
using System.Text.Json;
using Rehau.TokenHelper;

if (args.Contains("--help"))
{
    Console.WriteLine("REHAU token helper (.NET 10)\nRun without arguments to sign in with your normal browser.\nPaste the full final image redirect URL when prompted. Tokens are displayed only; no file is written.\nUse --self-test to run offline protocol checks.");
    return 0;
}
if (args.SequenceEqual(new[] { "--self-test" }))
    return await SelfTests.RunAsync();
if (args.Length != 0)
{
    Console.Error.WriteLine("Unknown arguments. Use --help.");
    return 1;
}

using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancellation.Cancel(); };
try
{
    var session = OAuthSession.Create();
    Console.WriteLine("REHAU token helper — your password and email verification code stay in your browser.");
    Console.WriteLine("Open this URL and sign in on accounts.rehau.com:");
    Console.WriteLine(session.AuthorizationUrl);
    try
    {
        Process.Start(new ProcessStartInfo(session.AuthorizationUrl.AbsoluteUri) { UseShellExecute = true });
    }
    catch
    {
        Console.WriteLine("Could not launch the browser. Open the URL above manually.");
    }
    Console.WriteLine("\nComplete login and email verification. At the final image page (even if it shows an error), copy the FULL address-bar URL.");
    Console.WriteLine("Keep this helper running: it holds the PKCE verifier needed to exchange that code.");
    Console.Write("\nFinal redirect URL: ");
    var input = await Console.In.ReadLineAsync(cancellation.Token);
    if (string.IsNullOrWhiteSpace(input)) throw new InvalidOperationException("No redirect URL supplied.");
    var code = session.ExtractCode(input);
    using var handler = new HttpClientHandler { AllowAutoRedirect = false };
    using var http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
    var tokens = await session.ExchangeAsync(http, code, cancellation.Token);
    Console.WriteLine("\nToken pair obtained. Paste the values into the matching Home Assistant fields:");
    Console.WriteLine($"\nrehau_access_token: {tokens.AccessToken}");
    Console.WriteLine($"\nrehau_refresh_token: {tokens.RefreshToken}");
    Console.WriteLine("\nSet rehau_email to the account used for login, then Save and restart the add-on.");
    Console.WriteLine("Tokens and terminal history are secrets. No token file was written. Close the terminal and clear your clipboard after configuration.");
    return 0;
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine("Cancelled or token exchange timed out. Start a fresh helper session before trying again.");
    return 1;
}
catch (HttpRequestException)
{
    Console.Error.WriteLine("Token exchange failed (network/TLS error). No credentials or response bodies are printed. Start a fresh helper session.");
    return 1;
}
catch (JsonException)
{
    Console.Error.WriteLine("REHAU returned an invalid JSON token response.");
    return 1;
}
catch (Exception error) when (error is InvalidOperationException or ArgumentException)
{
    Console.Error.WriteLine($"Error: {error.Message}");
    return 1;
}

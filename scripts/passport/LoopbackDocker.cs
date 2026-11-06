// Test-process wrapper only. Never replaces the installed Docker CLI.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
public class LoopbackDocker {
  static string Quote(string value) {
    var b=new StringBuilder("\""); int slashes=0;
    foreach(char c in value) {
      if(c=='\\') {slashes++; continue;}
      if(c=='\"') {b.Append('\\',slashes*2+1);b.Append(c);} else {b.Append('\\',slashes);b.Append(c);}
      slashes=0;
    }
    b.Append('\\',slashes*2);b.Append('"');return b.ToString();
  }
  static string Binding(string value) {
    if(Regex.IsMatch(value,@"^\d+(-\d+)?:\d+(-\d+)?(/(tcp|udp))?$")) return "127.0.0.1:"+value;
    if(value.StartsWith("127.0.0.1:")) return value;
    throw new Exception("Local Supabase guard rejected a non-loopback or implicit host port binding.");
  }
  public static int Main(string[] args) {
    try {
      var forwarded=new List<string>();
      for(int i=0;i<args.Length;i++) {
        string a=args[i];
        if(a=="-P" || a.StartsWith("--publish-all")) throw new Exception("Automatic port publishing is blocked.");
        if(a=="-p" || a=="--publish") {forwarded.Add(a);forwarded.Add(Binding(args[++i]));}
        else if(a.StartsWith("--publish=")) forwarded.Add("--publish="+Binding(a.Substring(10)));
        else if(a.StartsWith("-p") && a.Length>2) forwarded.Add("-p"+Binding(a.Substring(2)));
        else forwarded.Add(a);
      }
      string docker=Environment.GetEnvironmentVariable("PADEL_LOCAL_DOCKER_EXE");
      if(string.IsNullOrEmpty(docker)) throw new Exception("Explicit installed Docker CLI path is required.");
      var cmd=new StringBuilder();foreach(string arg in forwarded) {if(cmd.Length>0)cmd.Append(' ');cmd.Append(Quote(arg));}
      var info=new ProcessStartInfo(docker,cmd.ToString());
      info.UseShellExecute=false;info.CreateNoWindow=true;
      info.RedirectStandardOutput=true;info.RedirectStandardError=true;info.RedirectStandardInput=true;
      using(var p=Process.Start(info)) {
        var output=p.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());
        var error=p.StandardError.BaseStream.CopyToAsync(Console.OpenStandardError());
        System.Threading.Tasks.Task.Run(async delegate {try {await Console.OpenStandardInput().CopyToAsync(p.StandardInput.BaseStream);p.StandardInput.Close();} catch {}});
        p.WaitForExit();System.Threading.Tasks.Task.WaitAll(output,error);return p.ExitCode;
      }
    } catch(Exception e) {Console.Error.WriteLine(e.Message);return 2;}
  }
}

param(
  [Parameter(Mandatory=$true)][ValidateSet('Start','Reset','Status','Stop')][string]$Action,
  [Parameter(Mandatory=$true)][string]$Workdir,
  [Parameter(Mandatory=$true)][string]$Cli
)
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path -LiteralPath $Workdir).Path
$config=Join-Path $taskRoot 'supabase\config.toml'
if(-not ((Get-Content -Raw -LiteralPath $config) -match '(?m)^project_id = "padel-b1-local"$')) {throw 'Wrong local project identity'}
if(Test-Path -LiteralPath (Join-Path $taskRoot 'supabase\.temp\project-ref')) {throw 'Refusing a linked workspace'}
if((& $Cli --version).Trim() -ne '3.0.0') {throw 'This launcher was verified with Supabase CLI 3.0.0'}
$installedDocker=(Get-Command docker.exe).Source
if($installedDocker.StartsWith($taskRoot,[StringComparison]::OrdinalIgnoreCase)) {throw 'Run from a fresh shell with the installed Docker on PATH'}
$context=(& $installedDocker context inspect | ConvertFrom-Json)[0]
$allowedPipes=@('npipe:////./pipe/dockerDesktopLinuxEngine','npipe:////./pipe/docker_engine')
if($context.Endpoints.docker.Host -notin $allowedPipes) {throw 'Refusing a non-local Docker context'}
if($env:DOCKER_HOST -and $env:DOCKER_HOST -notin $allowedPipes) {throw 'Refusing a non-local Docker host override'}
$previousPath=$env:PATH
$previousDocker=$env:PADEL_LOCAL_DOCKER_EXE
try {
  $bin=Join-Path $taskRoot 'bin'
  New-Item -ItemType Directory -Path $bin -Force | Out-Null
  $compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  & $compiler /nologo /target:exe ('/out:'+(Join-Path $bin 'docker.exe')) (Join-Path $PSScriptRoot 'LoopbackDocker.cs')
  if($LASTEXITCODE -ne 0) {throw 'Loopback guard compilation failed'}
  $env:PADEL_LOCAL_DOCKER_EXE=$installedDocker
  $env:PATH=$bin+';'+$previousPath
  $network=& docker network inspect padel-b1-loopback 2>$null
  if($LASTEXITCODE -ne 0) {
    & docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 --label padel.validation=b1 padel-b1-loopback | Out-Null
    if($LASTEXITCODE -ne 0) {throw 'Dedicated local network creation failed'}
  } else {
    $info=($network | ConvertFrom-Json)[0]
    if($info.Labels.'padel.validation' -ne 'b1' -or $info.Internal) {throw 'Unexpected Docker network identity/configuration'}
  }
  if($Action -ne 'Status') {
    [string[]]$arguments=switch($Action) {
      'Start' {@('start')}
      'Reset' {@('db','reset','--no-seed')}
      'Stop' {@('stop','--project-id','padel-b1-local')}
    }
    $log=Join-Path $taskRoot ($Action.ToLowerInvariant()+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
    & $Cli @arguments --workdir $taskRoot --network-id padel-b1-loopback *> $log
    if($LASTEXITCODE -ne 0) {throw "Local Supabase $Action failed; review the private log at $log"}
  }
  # Deliberately avoid `supabase status` output, which includes generated secrets.
  $ids=@(& docker ps -q --filter name=_padel-b1-local)
  foreach($id in $ids) {
    $container=(& docker inspect $id | ConvertFrom-Json)[0]
    if($container.Name -notmatch '^/supabase_.+_padel-b1-local$') {throw 'Unexpected container name'}
    foreach($port in $container.NetworkSettings.Ports.PSObject.Properties) {
      foreach($binding in $port.Value) {
        if($binding.HostIp -ne '127.0.0.1') {
          & docker stop $ids | Out-Null
          throw 'Unexpected host binding: test containers stopped'
        }
      }
    }
  }
  & docker ps --filter name=_padel-b1-local --format '{{.Names}} | {{.Status}} | {{.Ports}}'
  Write-Output "Local Supabase $Action completed; existing app environment and hosted project unchanged."
} finally {
  $env:PATH=$previousPath
  $env:PADEL_LOCAL_DOCKER_EXE=$previousDocker
}

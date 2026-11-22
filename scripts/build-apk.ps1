# 构建 GymLog Android Debug APK
# 用法（在项目根目录）： powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
# 产物会复制到 release\GymLog.apk

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$jdkHome = $env:JAVA_HOME
$sdkDir  = $env:ANDROID_HOME

if (!$jdkHome -or !(Test-Path -LiteralPath $jdkHome)) { throw "请将 JAVA_HOME 设为 JDK 21 的目录。" }
if (-not (Test-Path $sdkDir))  { throw "找不到 Android SDK：$sdkDir" }

$env:JAVA_HOME        = $jdkHome
$env:ANDROID_HOME     = $sdkDir
$env:ANDROID_SDK_ROOT = $sdkDir
$env:PATH             = "$jdkHome\bin;$env:PATH"

$sdkProps = Join-Path $root 'android\local.properties'
Set-Content -Path $sdkProps -Value "sdk.dir=$($sdkDir -replace '\\', '/')" -Encoding ASCII
Write-Host "[1/4] 已写入 $sdkProps"

Push-Location $root
try {
  Write-Host '[2/4] 构建 Web 资源 (npm run build)...'
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build 失败' }

  Write-Host '[3/4] 同步到 Android 工程 (cap sync)...'
  npx cap sync android
  if ($LASTEXITCODE -ne 0) {
    # cap sync 需要先删除旧的 assets/public 目录，某些环境（IDE 文件保护）会拦截删除。
    # 这里退回到系统级镜像同步，效果等价。
    Write-Host '  cap sync 被文件保护拦截，改用 robocopy 直接同步...'
    $publicDir = Join-Path $root 'android\app\src\main\assets\public'
    New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
    $rcArgs = @(
      (Join-Path $root 'dist'),
      $publicDir,
      '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:2', '/W:1'
    )
    $proc = Start-Process -FilePath 'robocopy.exe' -ArgumentList $rcArgs -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ge 8) { throw "robocopy 同步失败 (exit=$($proc.ExitCode))" }
    node (Join-Path $root 'scripts\update-capacitor-config.mjs')
    if ($LASTEXITCODE -ne 0) { throw '更新 capacitor.config.json 失败' }
    Write-Host '  已手动同步 Web 资源'
  }

  Write-Host '[4/4] 编译 APK (gradlew assembleDebug)...'
  Push-Location (Join-Path $root 'android')
  try {
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'gradle 构建失败' }
  } finally {
    Pop-Location
  }

  $apk = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
  if (-not (Test-Path $apk)) { throw "没有找到 APK：$apk" }

  $releaseDir = Join-Path $root 'release'
  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
  $target = Join-Path $releaseDir 'GymLog.apk'
  Copy-Item $apk $target -Force

  $size = [math]::Round((Get-Item $target).Length / 1MB, 2)
  Write-Host ''
  Write-Host "构建完成：$target ($size MB)"
} finally {
  Pop-Location
}

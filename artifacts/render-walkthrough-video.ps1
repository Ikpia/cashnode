$ErrorActionPreference = "Stop"

$ffmpeg = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\ffmpeg.exe"
$artifactsDir = $PSScriptRoot
$framesDir = Join-Path $artifactsDir "walkthrough-frames"
$filterScript = Join-Path $artifactsDir "walkthrough-filter.txt"
$outputFile = Join-Path $artifactsDir "cashnode-ui-walkthrough.mp4"

if (-not (Test-Path $ffmpeg)) {
  throw "ffmpeg was not found at $ffmpeg"
}

$inputFrames = @(
  "00-landing.png",
  "01-signup.png",
  "02-sender-form.png",
  "03-request-detail.png",
  "04-receiver-portal.png",
  "05-pickup-pass.png",
  "07-agent-dashboard.png",
  "08-dashboard-full.png"
)

foreach ($frame in $inputFrames) {
  $framePath = Join-Path $framesDir $frame
  if (-not (Test-Path $framePath)) {
    throw "Missing frame: $framePath"
  }
}

$ffmpegArgs = @(
  "-y"
  "-i", (Join-Path $framesDir "00-landing.png")
  "-i", (Join-Path $framesDir "01-signup.png")
  "-i", (Join-Path $framesDir "02-sender-form.png")
  "-i", (Join-Path $framesDir "03-request-detail.png")
  "-i", (Join-Path $framesDir "04-receiver-portal.png")
  "-i", (Join-Path $framesDir "05-pickup-pass.png")
  "-i", (Join-Path $framesDir "07-agent-dashboard.png")
  "-i", (Join-Path $framesDir "08-dashboard-full.png")
  "-/filter_complex", $filterScript
  "-map", "[v]"
  "-c:v", "libx264"
  "-preset", "medium"
  "-crf", "20"
  "-pix_fmt", "yuv420p"
  "-movflags", "+faststart"
  $outputFile
)

& $ffmpeg @ffmpegArgs

Write-Output "Rendered: $outputFile"
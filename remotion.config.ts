import { Config } from '@remotion/cli/config'
import { existsSync } from 'node:fs'

Config.setEntryPoint('remotion/index.ts')
Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)

// Remotion downloads its own headless Chrome by default; on a machine without
// that download, an installed Chrome or Edge renders just as well.
const installed = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p))
if (process.env.REMOTION_BROWSER_EXECUTABLE) Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE)
else if (installed) Config.setBrowserExecutable(installed)

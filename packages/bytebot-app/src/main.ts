import { app, BrowserWindow, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

let agentProc: ChildProcess | undefined;
let daemonProc: ChildProcess | undefined;
let uiProc: ChildProcess | undefined;

function createWorkspace() {
  const dir = path.join(app.getPath('appData'), 'bytebot');
  const firstRun = !fs.existsSync(dir);
  if (firstRun) {
    fs.mkdirSync(dir, { recursive: true });
    dialog.showMessageBox({
      type: 'info',
      title: 'Bytebot Setup',
      message:
        'Bytebot requires network, file system, screen recording and accessibility permissions. Grant these if prompted.'
    });
  }
  return dir;
}

function spawnService(cwd: string, env: NodeJS.ProcessEnv) {
  const proc = spawn('npm', ['run', 'start'], { cwd, env, stdio: 'inherit' });
  proc.on('exit', code => {
    console.log(`${cwd} exited with code ${code}`);
  });
  return proc;
}

function startServices(workspaceDir: string) {
  const env = { ...process.env, BYTEBOT_WORKSPACE: workspaceDir };
  agentProc = spawnService(path.join(__dirname, '..', 'bytebot-agent'), env);
  daemonProc = spawnService(path.join(__dirname, '..', 'bytebotd'), env);
  uiProc = spawn('npm', ['run', 'start'], {
    cwd: path.join(__dirname, '..', 'bytebot-ui'),
    env: {
      ...env,
      BYTEBOT_AGENT_BASE_URL: 'http://localhost:9991',
      BYTEBOT_DESKTOP_VNC_URL: 'http://localhost:9990',
      NODE_ENV: 'production',
      PORT: '9992'
    },
    stdio: 'inherit'
  });
}

function createWindow() {
  const win = new BrowserWindow({ width: 1280, height: 800 });
  win.loadURL('http://localhost:9992');
}

app.whenReady().then(() => {
  const workspace = createWorkspace();
  startServices(workspace);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  for (const p of [agentProc, daemonProc, uiProc]) {
    if (p) p.kill();
  }
});

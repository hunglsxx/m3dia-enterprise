import { app, BrowserView, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { FfmpegUtil } from './ffmpeg-util';

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        },
        width: 800,
        icon: path.join(app.getAppPath(), 'icon.png'),
    });

    mainWindow.loadFile(path.join(__dirname, "ui/home.html"));

    mainWindow.webContents.setWindowOpenHandler((details) => {
        require("electron").shell.openExternal(details.url);
        return { action: 'deny' }
    });

    // mainWindow.webContents.openDevTools();
}

async function convert(event: any, path: string): Promise<void> {
    try {
        if (!fs.existsSync(path)) {
            throw new Error(`File is not exist ${path}`);
        }

        let ffmpegUtil = await FfmpegUtil.initialize({ inputPath: path });

        ffmpegUtil.on('start', (command) => {
            event.sender.send('ffmpeg-start', command);
        });

        ffmpegUtil.on('error', (error, stdout, stderr) => {
            event.sender.send('ffmpeg-error', error, stdout, stderr);
        });

        ffmpegUtil.on('progress', (progress) => {
            event.sender.send('ffmpeg-progress', progress);
        });

        ffmpegUtil.on('end', (data) => {
            event.sender.send('ffmpeg-end', data);
            ffmpegUtil.ffmpegScreenShot();
        });

        ffmpegUtil.on('screenshot', (base64) => {
            event.sender.send('ffmpeg-screenshot', base64);
        });

        ffmpegUtil.ffmpegConvert();

    } catch (error) {
        throw error;
    }
}

app.whenReady().then(() => {
    ipcMain.handle('convert', convert);
    createWindow();
    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
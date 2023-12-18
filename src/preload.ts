import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('m3dia', {
    convert: (path: string) => {
        ipcRenderer.invoke('convert', path);
    },

    on: (cbEvent: string, callback: Function) => {
        ipcRenderer.on(cbEvent, (event, ...args) => {
            callback(...args);
        });
    }
});
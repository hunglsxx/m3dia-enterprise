import { EventEmitter } from 'events';
import ffmpeg from 'fluent-ffmpeg';
import mime from 'mime-types';
import path from 'path';
import fs from 'fs';
import Os from 'os';
import { spawnSync } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';

export interface UtilConfig {
    inputPath: string,
    outputPath?: string,
    metadata?: any;
}

export interface InitConfig {
    inputPath: string,
    outputPath?: string
}

declare var process: {
    pkg: any
}

export class FfmpegUtil extends EventEmitter {
    public inputPath: string;
    public outputPath: string;
    public metadata: any;

    private _screenshot: string | undefined;

    private constructor(opts: UtilConfig) {
        super();
        this.inputPath = opts.inputPath;
        this.metadata = opts.metadata;
        this.outputPath = opts.outputPath || (path.join(
            this._inputDir,
            `${(path.parse(this.inputPath)).name}-${Date.now()}-convert.mp4`
        ));

        // if (process.pkg) this._configFfmpeg();
        console.log(ffmpegPath, ffprobePath?.path);

        if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
        if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath.path);
    }

    private _copy(source: any, target: any) {
        if (process.pkg) {
            const data = fs.readFileSync(source);
            fs.writeFileSync(target, data);
        } else {
            fs.copyFileSync(source, target);
        }
    }

    private _configFfmpeg() {
        let os = Os.platform();
        let ext = '';
        if (os === 'win32') ext = '.exe';

        const ffmpegPath = path.join(__dirname, '../assets/ffmpeg' + ext);
        const ffprobePath = path.join(__dirname, '../assets/ffprobe' + ext);

        const pwd = spawnSync('pwd', { encoding: 'utf-8', shell: true });
        const targetDir = pwd.stdout.toString().trim();

        const ffmpegTmp = path.join(targetDir, 'ffmpeg' + ext);
        const ffprobeTmp = path.join(targetDir, 'ffprobe' + ext);

        if (!fs.existsSync(ffmpegTmp)) {
            this._copy(ffmpegPath, ffmpegTmp);
            fs.chmodSync(ffmpegTmp, 0o755);
        }
        if (!fs.existsSync(ffprobeTmp)) {
            this._copy(ffprobePath, ffprobeTmp);
            fs.chmodSync(ffprobeTmp, 0o755);
        }

        ffmpeg.setFfmpegPath(ffmpegTmp);
        ffmpeg.setFfprobePath(ffprobeTmp);
    }

    private get _inputDir(): string {
        return path.parse(this.inputPath).dir;
    }


    static async initialize(opts: InitConfig): Promise<FfmpegUtil> {
        let metadata = await FfmpegUtil.metadata(opts.inputPath);
        return new FfmpegUtil({ ...opts, metadata });
    }

    public static metadata(inputPath: string): any {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath).ffprobe((err: any, metadata: any) => {
                if (err) return reject(err);
                return resolve(metadata);
            });
        });
    }

    private get _config(): any {
        return {
            "videos": {
                "mp4": [
                    "video/mp4",
                    "application/mp4",
                    "video/x-m4v"
                ],
                "mov": [
                    "video/quicktime"
                ],
                "webm": [
                    "video/webm"
                ],
                "mkv": [
                    "video/x-matroska"
                ]
            }
        };
    }

    public get ffmpegOptions(): any {
        try {
            let opts: any = {
                input: [],
                output: []
            };
            let metadata = this.metadata;

            if (!metadata.streams || !metadata.format) {
                throw new Error('Metadata invalid');
            }

            if (metadata.streams.length < 2) {
                throw new Error(`Metadata stream invalid. Stream length ${metadata.streams.length}`);
            }

            let videoStream;
            for (let i in metadata.streams) {
                if (metadata.streams[i].codec_type == 'video') {
                    videoStream = metadata.streams[i];
                    break;
                }
            }

            const mimetype = mime.lookup(metadata.format.filename);

            let outputOpts = [
                '-map 0:v:0',
                '-map 0:a:0',
                '-movflags +faststart',
                '-use_wallclock_as_timestamps 1',
                '-crf 25'
            ];
            // mp4 thì copy luôn
            if (this._config.videos.mp4.includes(mimetype)) {
                outputOpts.push('-c copy');
            }
            // mov thì sử dụng thằng này
            if (this._config.videos.mov.includes(mimetype)) {
                outputOpts.push('-q:v 0');
            }

            let listVF = [];

            // Chỗ này lật lại theo chiều cao (hflip) nếu video bị quay
            if (videoStream.rotation) {
                let cr = outputOpts.indexOf('-c copy');
                if (typeof cr !== 'undefined') {
                    outputOpts.splice(cr, 1);
                }

                if (videoStream.rotation == 90) {
                    listVF.push('transpose=1,transpose=2');
                } else if (videoStream.rotation == -90 || videoStream.rotation == 270) {
                    listVF.push('transpose=2,transpose=1');
                } else {
                    listVF.push('hflip');
                }
            }

            // Chuyển codec
            if (videoStream.codec_name && videoStream.codec_name == 'hevc') {
                let cr = outputOpts.indexOf('-c copy');
                if (typeof cr !== 'undefined') {
                    outputOpts.splice(cr, 1);
                }

                outputOpts.push('-c:v libx264');
            }

            if (videoStream.codec_name && videoStream.codec_name != 'h264' && videoStream.codec_name != 'hevc') {
                let cr = outputOpts.indexOf('-c copy');
                if (typeof cr !== 'undefined') {
                    outputOpts.splice(cr, 1);
                }
            }

            if (listVF.length !== 0) {
                outputOpts.push(`-vf ${listVF.join(",")}`);
            }

            opts.output = outputOpts;
            return opts;
        } catch (error) {
            throw error;
        }
    }

    public ffmpegConvert(): void {
        ffmpeg(this.inputPath)
            .inputOption(this.ffmpegOptions.input)
            .outputOptions(this.ffmpegOptions.output)
            .output(this.outputPath)
            .on('error', (error, stdout, stderr) => {
                this.emit('error', error, stdout, stderr);
            })
            .on('start', (command) => {
                this.emit('start', command)
            })
            .on('progress', async (progress) => {
                this.emit('progress', progress);
            })
            .on('end', () => {
                this.emit('end', { inputPath: this.inputPath, outputPath: this.outputPath });
            }).run();
    }

    public ffmpegScreenShot(): void {
        let that = this;
        ffmpeg(this.inputPath)
            .on('filenames', function (filenames) {
                if (filenames && filenames.length) {
                    that._screenshot = `${(path.join(that._inputDir, filenames[0]))}`;
                }
            })
            .on('error', (err) => {
                that.emit('screenshot-error', err);
            })
            .on('end', function () {
                if (that._screenshot) {
                    let bitmap = fs.readFileSync(that._screenshot);
                    let base64 = Buffer.from(bitmap).toString('base64');
                    that.emit('screenshot', `${base64}`);
                }
            })
            .screenshots({
                count: 1,
                folder: that._inputDir
            });
    }
}

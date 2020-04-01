const {Module, Modules: {readdirp}} = require('mf-lib');
const WebServer = require('mf-webserver');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const path = require('path');
const fs = require('fs');

const {model: CollectionModel} = require('./models/Collection');
const {model: LibraryModel} = require('./models/Library');
const {model: MediaModel} = require('./models/Media');

const parameterMapping = {
    //'start': 'seekInput',
    'size': 'size',
    'audioCodec': 'audioCodec',
    'audioBitrate': 'audioBitrate',
    'audioChannels': 'audioChannels',
    'videoCodec': 'videoCodec',
    'videoBitrate': 'videoBitrate',
    'inputOptions': 'inputOptions',
    'outputOptions': 'outputOptions',
    'format': 'toFormat'
};

async function getMeta(file) {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(file, function (err, metadata) {
            resolve(metadata);
        });
    });
}

/**
 * @type VideoStreamModule
 */
class VideoStreamModule extends Module {

    async init() {
    }

    async postInit() {
        WebServer.registerRoute("/stream/:mediaId/:preset", this.streamHandler.bind(this));
        this.loadLibraries();
    }

    async loadLibraries() {
        const libraries = await LibraryModel.find({});
        for (let library of libraries) {
            for await (const {path: filePath, fullPath, basename} of readdirp(library.path)) {
                if (filePath.indexOf(".cache") !== -1) {
                    continue;
                }
                let media = await MediaModel.findOne({filePath});

                if (!media) {
                    this.log.info("adding media", basename);
                    media = new MediaModel({
                        title: basename,
                        fileType: path.extname(filePath).replace(".", ""),
                        filePath,
                        fullPath,
                        library: library._id
                    });
                    await media.save();
                } else if (media.fullPath !== fullPath) {
                    media.set("fullPath", fullPath);
                    await media.save();
                }

                let collection = await CollectionModel.findOne({
                    title: path.dirname(filePath)
                });

                if (!collection) {
                    this.log.info("adding collection", path.dirname(filePath));
                    collection = new CollectionModel({
                        title: path.dirname(filePath),
                        medias: [media],
                        library: library._id
                    });
                    await collection.save();
                } else if (collection.medias.indexOf(media._id) === -1) {
                    collection.medias.push(media);
                    await collection.save();
                }
            }
        }
    }

    async streamMedia(id, options) {
        let {start, original, format, videoBitrate, audioBitrate} = options;
        const media = await MediaModel.findOne({_id: id});
        let {size: fileSize} = fs.statSync(media.fullPath);

        let processingPipeline;
        if (original) {
            processingPipeline = fs.createReadStream(media.fullPath);
        } else {
            const {format: {duration}} = await getMeta(media.fullPath);
            processingPipeline = ffmpeg(media.fullPath);
            processingPipeline.on('start', function (commandLine) {
                console.log('Spawned Ffmpeg with command: ' + commandLine);
            });
            //processingPipeline.native();
            for (const [property, value] of Object.entries(options)) {
                if (parameterMapping[property]) {
                    processingPipeline[parameterMapping[property]](value);
                }
            }

            if (videoBitrate && audioBitrate) {
                const combinedBitrate = (videoBitrate + audioBitrate) * 1000;
                fileSize = duration * combinedBitrate;
                if (start) {
                    console.log(start / combinedBitrate);
                    processingPipeline.seekInput(start / combinedBitrate);
                }
            }
        }

        return {
            mediaStream: processingPipeline,
            fileName: media.get('title'),
            fileType: format || '',
            fileSize: fileSize,
            rangeFrom: start || 0
        }
    }

    async streamHandler(ctx, next) {
        const preset = this.config.get("presets." + ctx.params.preset);
        if (ctx.get('Range')) {
            preset.start = parseInt(ctx.get('Range').replace(/[^0-9]/g, ''));
        }

        const {mediaStream, fileType, fileSize, rangeFrom} = await this.streamMedia(ctx.params.mediaId, preset);

        ctx.type = 'video/' + fileType;
        ctx.body = stream.PassThrough();
        ctx.length = fileSize;
        ctx.set('Accept-Ranges', 'bytes');
        ctx.set('Content-Range', 'bytes ' + rangeFrom + '-' + fileSize);

        mediaStream.on("error", (err, stdout, stderr) => {
            console.log('Error: ' + err.message);
            /*console.log('ffmpeg output:\n' + stdout);
            console.log('ffmpeg stderr:\n' + stderr);*/
            next();
        });
        mediaStream.on("end", () => {
            next();
        });
        mediaStream.pipe(ctx.body, {end: true});
    }
}

module.exports = new VideoStreamModule();

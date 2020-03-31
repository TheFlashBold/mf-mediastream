const {Module, Modules: {readdirp}} = require('mf-lib');
const WebServer = require('mf-webserver');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const path = require('path');
const fs = require('fs');

const {model: CollectionModel} = require('./models/Collection');
const {model: LibraryModel} = require('./models/Library');
const {model: MediaModel} = require('./models/Media');

/**
 * @type VideoStreamModule
 */
class VideoStreamModule extends Module {

    async init() {
    }

    async postInit() {
        WebServer.registerRoute("/stream/:mediaId/:preset", this.streamHandler.bind(this));
        // await this.loadLibraries();
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
        const media = await MediaModel.findOne({_id: id});
        const fileStream = fs.createReadStream(media.fullPath);

        const mediaStream = ffmpeg(fileStream)
            //.seekInput(options.start || 0)
            .videoCodec("libvpx-vp9")
            .videoBitrate(options.videoBitrate, true)
            .audioBitrate(options.audioBitrate, true)
            .size(options.size)
            .outputOptions("-row-mt 1")
            .toFormat("webm");

        return {
            mediaStream,
            fileName: media.get("title"),
            fileType: "webm",
            fileSize: media.get("info.format.size")
        }
    }

    async streamHandler(ctx, next) {
        const preset = this.config.get("presets." + ctx.params.preset);
        //preset.start = ctx.query.start;
        const {mediaStream, fileType, fileSize} = await this.streamMedia(ctx.params.mediaId, preset);

        ctx.type = fileType;
        ctx.body = stream.PassThrough();
        ctx.length = fileSize;

        mediaStream.pipe(ctx.body, {end: true});
        mediaStream.on("error", (error) => {
            console.error(error);
            next();
        });
        mediaStream.on("end", () => {
            next();
        });
    }
}

module.exports = new VideoStreamModule();
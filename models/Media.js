const ffmpeg = require('fluent-ffmpeg');
const mongoose = require('mongoose');

module.exports = function (app) {
    const schema = new mongoose.Schema({
        title: {
            type: String
        },
        fileType: {
            type: String
        },
        filePath: {
            type: String
        },
        fullPath: {
            type: String
        },
        library: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'library'
        },
        info: {
            type: mongoose.Schema.Types.Mixed
        }
    });

    schema.method.getInfo = async function (forceNew = false) {
        if (!forceNew && this.info) {
            return this.info;
        }
        return new Promise((resolve, reject) => {
            ffmpeg(this.filePath).ffprobe(0, async (err, data) => {
                if (err) {
                    return reject(err);
                }
                this.set("info", data);
                await this.save();
                resolve(data);
            });
        });
    };

    return schema;
};

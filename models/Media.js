const {registerModel, Schema, Types} = require("../../database");
const ffmpeg = require("fluent-ffmpeg");

const schema = new Schema({
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
        type: String
    },
    info: {
        type: Types.Mixed
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
const model = registerModel("media", schema);

module.exports = {
    model: model,
    schema: schema
};
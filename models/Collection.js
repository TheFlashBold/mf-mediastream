const {Modules: {request}} = require('mf-lib');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

module.exports = function (app) {
    const database = app.getModule('database');

    const schema = new mongoose.Schema({
        title: {
            type: String
        },
        medias: [{
            type: mongoose.Types.ObjectId,
            ref: 'media'
        }],
        library: {
            type: mongoose.Types.ObjectId,
            ref: 'library'
        },
        info: {
            title: {
                type: String
            },
            year: {
                type: Number
            },
            imdbId: {
                type: String
            },
            image: {
                type: String
            }
        }
    });

    schema.methods.getInfo = async function (forceNew = false) {
        if (!forceNew && this.get("info.title")) {
            return this.info;
        }

        let title = this.title.replace(/[^.]/, "");
        title = encodeURIComponent(title.toLowerCase());
        const data = await request({
            method: "GET",
            uri: `https://v2.sg.media-imdb.com/suggestion/${title[0]}/${title}.json`,
            json: true
        });

        if (!data.d) {
            return false;
        }

        const entry = data.d.find(({id}) => id.startsWith("tt"));

        if (!entry) {
            return false;
        }

        this.set("info.title", entry.l);
        this.set("info.imdbId", entry.id);
        this.set("info.year", entry.y);

        if (entry.i && entry.i.imageUrl) {
            const library = await database.getModel('library').findOne({_id: this.get('library')});
            try {
                let imageData = await request({
                    uri: entry.i.imageUrl,
                    encoding: null,
                    method: "GET"
                });
                imageData = Buffer.from(imageData, 'utf8');
                const imagePath = path.join(library.path, ".cache", this._id + ".jpg");
                fs.writeFileSync(imagePath, imageData, "UTF-8");
                this.set("info.image", imagePath);
            } catch (e) {
                console.error(e);
            }
        }
        await this.save();
    };

    return schema;
};

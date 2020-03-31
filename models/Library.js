const {registerModel, Schema, Types} = require("../../database");

const schema = new Schema({
    title: {
        type: String
    },
    type: {
        type: String,
        enum: ["movies", "series", "books", "videos", "photos"]
    },
    path: {
        type: String
    }
});
const model = registerModel("library", schema);

module.exports = {
    model: model,
    schema: schema
};
const {registerModel, Schema} = require('mf-database');

const schema = new Schema({
    title: {
        type: String
    },
    type: {
        type: String,
        enum: ['movies', 'series', 'books', 'videos', 'photos']
    },
    path: {
        type: String
    }
});
const model = registerModel('library', schema);

module.exports = {
    model: model,
    schema: schema
};

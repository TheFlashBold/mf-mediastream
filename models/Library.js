const mongoose = require('mongoose');

module.exports = function (app) {
    return new mongoose.Schema({
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
};

const MediaStreamModule = require('./lib/MediaStreamModule');

const CollectionModel = require('./models/Collection');
const LibraryModel = require('./models/Library');
const MediaModel = require('./models/Media');

module.exports = {
    module: MediaStreamModule,
    data: {
        models: {
            collection: CollectionModel,
            library: LibraryModel,
            media: MediaModel
        }
    }
};

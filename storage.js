const { get } = require('http');
const { supabase } = require('./supabaseClient.js');
function getDestination(req, file, cb) {
    cb(null, `/${new Date().toISOString().replace(/:/g, '-')}-${file.originalname}`);
}
function supabaseStorage(opts) {
    this.getDestination = getDestination;
}

supabaseStorage.prototype._handleFile = function _handleFile(req, file, cb) {
    this.getDestination(req, file, function (err, path) {
        if (err) return cb(err);
        var chunks = [];
        var size = 0;
        file.stream.on('data', function (chunk) {
            chunks.push(chunk);
            size += chunk.length;
        });
        file.stream.on('end', function () {
            var buffer = Buffer.concat(chunks, size);
            // convert the buffer to jpeg
            supabase.storage.from('profile-pics').upload(path, buffer, {
                contentType: `image/${file.mimetype.split('/')[1]}`
            }).then((res) => {
                cb(null, {
                    path: path,
                    size: size,
                    key: res.key
                });
            }).catch((err) => {
                console.log("Failed to upload file", file.originalname, "to Supabase", err)
                cb(err);
            });
        });
    });
};

supabaseStorage.prototype._removeFile = function _removeFile(req, file, cb) {
    supabase.storage.from('profile-pics').remove([file.key]).then(() => {
        cb(null);
    }).catch((err) => {
        cb(err);
    });
};

module.exports = {
    supabaseStorage: function (opts) {
        return new supabaseStorage(opts)
    }
}
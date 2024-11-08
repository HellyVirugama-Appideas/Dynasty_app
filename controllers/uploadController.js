const multer = require('multer');
const shortid = require('shortid');

exports.uploadS3Bucket = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 10 },
    fileFilter: (req, file, cb) => {
        // Check the mimetype for images and audio files
        if (
            (file.fieldname === 'image' || file.fieldname === 'images') &&
            !file.mimetype.startsWith('image/')
        )
            cb(createError.BadRequest('Please upload valid image.'), false);
        else if (
            (file.fieldname === 'audio' || file.fieldname === 'staffAudio') &&
            !(
                file.mimetype.startsWith('audio/') ||
                file.mimetype.startsWith('video/')
            )
        )
            cb(createError.BadRequest('Please upload valid audio.'), false);
        else cb(null, true);
    },
});

exports.uploadImageS3Bucket = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 20 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png')
            cb(null, true);
        else
            cb(createError.BadRequest('Please upload jpg or png file.'), false);
    },
});

exports.upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, './public/uploads/');
        },
        filename: function (req, file, cb) {
            cb(
                null,
                shortid.generate() + file.originalname.replaceAll(' ', '')
            );
        },
    }),
    limits: { fileSize: 1024 * 1024 * 10 },
    fileFilter: (req, file, cb) => {
        // reject a file
        if (
            file.mimetype === 'image/jpeg' ||
            file.mimetype === 'image/png' ||
            file.mimetype === 'application/octet-stream'
        )
            cb(null, true);
        else cb(new Error('Please upload jpg or png file.'), false);
    },
});

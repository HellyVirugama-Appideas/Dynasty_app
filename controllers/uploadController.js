const multer = require('multer');
const shortid = require('shortid');

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
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png')
            cb(null, true);
        else cb(new Error('Please upload jpg or png file.'), false);
    },
});

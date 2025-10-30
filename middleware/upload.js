// const multer = require('multer');
// const path = require('path');

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'public/uploads/');
//     },
//     filename: (req, file, cb) => {
//         const ext = path.extname(file.originalname);
//         cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
//     }
// });

// const upload = multer({
//     storage,
//     limits: { fileSize: 5 * 1024 * 1024 },
//     fileFilter: (req, file, cb) => {
//         const allowed = /jpeg|jpg|png|gif/;
//         const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
//         const mimeOk = allowed.test(file.mimetype);
//         if (extOk && mimeOk) return cb(null, true);
//         cb(new Error('Only images allowed'));
//     }
// });

// module.exports = upload;
// middleware/upload.js

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
        cb(null, name);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimeOk = allowed.test(file.mimetype);
        if (extOk && mimeOk) return cb(null, true);
        cb(new Error('Only image files allowed'));
    }
});

module.exports = {
    upload
};
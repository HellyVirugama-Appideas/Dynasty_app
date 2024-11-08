const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { uploadImageS3Bucket } = require('../../controllers/uploadController');
const { checkUser } = require('../../controllers/user/authController');
const rentController = require('../../controllers/user/rentController');

router.post('/list_cars', checkUser, fileUpload(), rentController.listCars);

router.get('/car_detail/:id', checkUser, rentController.carDetail);

router.post('/book_car', checkUser, fileUpload(), rentController.bookCar);

router.post(
    '/temp_payment',
    checkUser,
    fileUpload(),
    rentController.tempPayment
);

// favorites
router.get('/favorites', checkUser, rentController.getFavorites);
router.post(
    '/favorites/add-remove',
    checkUser,
    fileUpload(),
    rentController.toggleFavorite
);

// Rating
router.post('/give_rating', fileUpload(), checkUser, rentController.addRating);

// booked
router.get('/booked/:type', checkUser, rentController.getBookings);

// history
router.get('/history', checkUser, rentController.getHistory);

router.post(
    '/cancel_booking',
    fileUpload(),
    checkUser,
    rentController.cancelBooking
);

router.post(
    '/signature/:type',
    uploadImageS3Bucket.single('sign'),
    checkUser,
    rentController.uploadSignature
);

module.exports = router;

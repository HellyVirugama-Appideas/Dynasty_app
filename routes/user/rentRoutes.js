const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkUser } = require('../../controllers/user/authController');
const rentController = require('../../controllers/user/rentController');

router.post('/list_cars', checkUser, fileUpload(), rentController.listCars);

router.get('/car_detail/:id', checkUser, rentController.carDetail);

// favorites
router.get('/favorites', checkUser, rentController.getFavorites);
router.post(
    '/favorites/add',
    checkUser,
    fileUpload(),
    rentController.addToFavorites
);

router.post(
    '/favorites/remove',
    checkUser,
    fileUpload(),
    rentController.removeFromFavorites
);

module.exports = router;

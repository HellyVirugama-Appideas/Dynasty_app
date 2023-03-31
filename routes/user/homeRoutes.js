const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkUser } = require('../../controllers/user/authController');
const homeController = require('../../controllers/user/homeController');

// country_city
router
    .route('/select_country_city')
    .get(checkUser, homeController.getSelectCountryCity)
    .post(fileUpload(), checkUser, homeController.postSelectCountryCity);

// banner
router.get('/banner', homeController.getBanners);

module.exports = router;

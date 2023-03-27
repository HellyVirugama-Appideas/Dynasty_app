const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkUser } = require('../../controllers/api/authController');
const homeController = require('../../controllers/api/homeController');

// country_city
router
    .route('/select_country_city')
    .get(checkUser, homeController.getSelectCountryCity)
    .post(fileUpload(), checkUser, homeController.postSelectCountryCity);

module.exports = router;

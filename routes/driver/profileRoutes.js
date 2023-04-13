const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkDriver } = require('../../controllers/driver/authController');
const profileController = require('../../controllers/driver/profileController');

// profile
router.get('/get_profile_data', checkDriver, profileController.getProfile);
router.post(
    '/edit_profile',
    fileUpload(),
    checkDriver,
    profileController.editProfile
);
router.get('/delete_profile', checkDriver, profileController.deleteProfile);

// country_city
router
    .route('/select_country_city')
    .get(checkDriver, profileController.getSelectCountryCity)
    .post(fileUpload(), checkDriver, profileController.postSelectCountryCity);

module.exports = router;

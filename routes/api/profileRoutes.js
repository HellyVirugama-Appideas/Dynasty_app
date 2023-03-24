const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkUser } = require('../../controllers/api/authController');
const profileController = require('../../controllers/api/profileController');

// profile
router.get('/get_profile_data', checkUser, profileController.getProfile);

router.post(
    '/edit_profile',
    fileUpload(),
    checkUser,
    profileController.editProfile
);

router.get('/delete_profile', checkUser, profileController.deleteProfile);

// address
router.get('/address_list', checkUser, profileController.addressList);
router.post(
    '/add_address',
    fileUpload(),
    checkUser,
    profileController.addAddress
);
router.post(
    '/edit_address/:id',
    fileUpload(),
    checkUser,
    profileController.editAddress
);
router.get('/delete_address/:id', checkUser, profileController.deleteAddress);
router.get('/select_address/:id', checkUser, profileController.selectAddress);

// country_city
router.get(
    '/selected_country_city',
    checkUser,
    profileController.selectedCountryCity
);

module.exports = router;

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

module.exports = router;

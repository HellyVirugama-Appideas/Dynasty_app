const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { uploadImageS3Bucket } = require('../../controllers/uploadController');
const { checkUser } = require('../../controllers/user/authController');
const profileController = require('../../controllers/user/profileController');

// profile
router.get('/get_profile_data', checkUser, profileController.getProfile);

router.post(
    '/edit_profile',
    uploadImageS3Bucket.fields([
        { name: 'profile', maxCount: 1 },
        { name: 'licenseFront', maxCount: 1 },
        { name: 'licenseBack', maxCount: 1 },
    ]),
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
    '/edit_address',
    fileUpload(),
    checkUser,
    profileController.editAddress
);
router.post(
    '/delete_address',
    fileUpload(),
    checkUser,
    profileController.deleteAddress
);
router.post(
    '/select_address',
    fileUpload(),
    checkUser,
    profileController.selectAddress
);

module.exports = router;

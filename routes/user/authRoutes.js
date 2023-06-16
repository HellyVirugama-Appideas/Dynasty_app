const router = require('express').Router();
const fileUpload = require('express-fileupload');

const authController = require('../../controllers/user/authController');
const { upload } = require('../../controllers/uploadController');

router.post('/send_otp', fileUpload(), authController.sendOTP);

router.post('/verify_otp', fileUpload(), authController.verifyOTP);

router.post(
    '/create_profile',
    upload.fields([
        { name: 'profile', maxCount: 1 },
        { name: 'licenseFront', maxCount: 1 },
        { name: 'licenseBack', maxCount: 1 },
    ]),
    authController.createProfile
);

router.post('/social_login', fileUpload(), authController.socialLogin);

router.post(
    '/create_social_profile',
    upload.fields([
        { name: 'profile', maxCount: 1 },
        { name: 'licenseFront', maxCount: 1 },
        { name: 'licenseBack', maxCount: 1 },
    ]),
    authController.createSocialProfile
);

module.exports = router;

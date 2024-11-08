const router = require('express').Router();

const adminController = require('../../controllers/admin/adminController');
const { uploadImageS3Bucket } = require('../../controllers/uploadController');

// country
router.get('/country', adminController.getCountries);
router
    .route('/country/add')
    .get(adminController.getAddCountry)
    .post(uploadImageS3Bucket.single('image'), adminController.postAddCountry);
router
    .route('/country/edit/:id')
    .get(adminController.getEditCountry)
    .post(uploadImageS3Bucket.single('image'), adminController.postEditCountry);
router.get('/country/delete/:id', adminController.getDeleteCountry);

// city
router.get('/city', adminController.getCities);
router
    .route('/city/add')
    .get(adminController.getAddCity)
    .post(adminController.postAddCity);
router
    .route('/city/edit/:id')
    .get(adminController.getEditCity)
    .post(adminController.postEditCity);
router.get('/city/delete/:id', adminController.getDeleteCity);

// banner
router.get('/banner', adminController.getBanners);
router
    .route('/banner/add')
    .get(adminController.getAddBanner)
    .post(uploadImageS3Bucket.single('image'), adminController.postAddBanner);
router
    .route('/banner/edit/:id')
    .get(adminController.getEditBanner)
    .post(uploadImageS3Bucket.single('image'), adminController.postEditBanner);
router.get('/banner/delete/:id', adminController.getDeleteBanner);

// type
router.get('/type', adminController.getTypes);
router
    .route('/type/add')
    .get(adminController.getAddType)
    .post(uploadImageS3Bucket.single('image'), adminController.postAddType);
router
    .route('/type/edit/:id')
    .get(adminController.getEditType)
    .post(uploadImageS3Bucket.single('image'), adminController.postEditType);

// charge
router
    .route('/charge')
    .get(adminController.getCharges)
    .post(adminController.postCharges);

module.exports = router;

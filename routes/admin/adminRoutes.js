const router = require('express').Router();

const adminController = require('../../controllers/admin/adminController');
const { upload } = require('../../middleware/upload');

// country
router.get('/country', adminController.getCountries);
router
    .route('/country/add')
    .get(adminController.getAddCountry)
    .post(upload.single('image'), adminController.postAddCountry);
router
    .route('/country/edit/:id')
    .get(adminController.getEditCountry)
    .post(upload.single('image'), adminController.postEditCountry);
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
    .post(upload.single('image'), adminController.postAddBanner);
router
    .route('/banner/edit/:id')
    .get(adminController.getEditBanner)
    .post(upload.single('image'), adminController.postEditBanner);
router.get('/banner/delete/:id', adminController.getDeleteBanner);

// type
router.get('/type', adminController.getTypes);
router
    .route('/type/add')
    .get(adminController.getAddType)
    .post(upload.single('image'), adminController.postAddType);
router
    .route('/type/edit/:id')
    .get(adminController.getEditType)
    .post(upload.single('image'), adminController.postEditType);

// charge
router
    .route('/charge')
    .get(adminController.getCharges)
    .post(adminController.postCharges);

module.exports = router;

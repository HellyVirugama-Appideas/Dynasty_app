const router = require('express').Router();

const userController = require('../../controllers/admin/userController');

router.get('/', userController.getAllUsers);

router.get('/:id', userController.viewUser);

router.get('/block/:id', userController.blockUser);

router.get('/unblock/:id', userController.unblockUser);

module.exports = router;

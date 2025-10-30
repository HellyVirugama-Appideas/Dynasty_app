const router = require('express').Router();

const userController = require('../../controllers/admin/userController');

router.get('/', userController.getAllUsers);

router.get('/:id', userController.viewUser);

router.get('/block/:id', userController.blockUser);

router.get('/unblock/:id', userController.unblockUser);

router.get('/edit/:id', userController.editUser);

router.put('/update/:id', userController.updateUser);

// Delete
router.delete('/delete/:id', userController.deleteUser);

module.exports = router;

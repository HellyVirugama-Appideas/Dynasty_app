const User = require('../../models/userModel');
const deleteFile = require("../../utils/deleteFile")

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('+blocked').sort('-_id');
        res.render('user', { users });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.viewUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('city', 'en.name')
            .populate('country', 'en.name');

        if (!user) {
            req.flash('red', 'User not found!');
            return res.redirect('/admin/user');
        }

        res.render('user_view', { user });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'User not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/user');
    }
};

exports.blockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { blocked: true },
            { strict: false }
        );
        req.flash('green', `'${user.name}' blocked successfully.`);
        res.redirect('/admin/user');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'User not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/user');
    }
};

exports.unblockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { blocked: false },
            { strict: false }
        );
        req.flash('green', `'${user.name}' unblocked successfully.`);
        res.redirect('/admin/user');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'User not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/user');
    }
};


// EDIT USER - GET
exports.editUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('city', 'en.name')
            .populate('country', 'en.name');

        if (!user) {
            req.flash('red', 'User not found!');
            return res.redirect('/admin/user');
        }

        res.render('user_edit', { user });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'User not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/user');
    }
};

// UPDATE USER - PUT
exports.updateUser = async (req, res) => {
    try {
        const allowedUpdates = {
            name: req.body.name,
            email: req.body.email,
            country_code: req.body.country_code,
            phone: req.body.phone,
            country: req.body.country || null,
            city: req.body.city || null,
            blocked: req.body.blocked === 'on'
        };

        const user = await User.findByIdAndUpdate(
            req.params.id,
            allowedUpdates,
            { new: true, runValidators: true }
        );

        if (!user) {
            req.flash('red', 'User not found!');
            return res.redirect('/admin/user');
        }

        req.flash('green', `'${user.name}' updated successfully.`);
        res.redirect('/admin/user');
    } catch (error) {
        req.flash('red', error.message || 'Update failed.');
        res.redirect(`/admin/user/edit/${req.params.id}`);
    }
};

// DELETE USER
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('red', 'User not found!');
            return res.redirect('/admin/user');
        }

        // Delete profile image
        if (user.profile) {
            deleteFile(`public${user.profile}`);
        }

        await User.findByIdAndDelete(req.params.id);

        req.flash('green', `'${user.name}' deleted successfully.`);
        res.redirect('/admin/user');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/user');
    }
};


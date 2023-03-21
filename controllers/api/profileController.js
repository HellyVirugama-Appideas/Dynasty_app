const User = require('../../models/userModel');

exports.getProfile = async (req, res, next) => {
    try {
        const user = { ...req.user._doc };

        // Hide fields
        user.blocked = undefined;

        res.json({ code: '1', message: req.t('success'), user });
    } catch (error) {
        next(error);
    }
};

exports.editProfile = async (req, res, next) => {
    try {
        // Not allowed to change
        delete req.body.country_code;
        delete req.body.phone;

        const user = await User.findByIdAndUpdate(req.user.id, req.body, {
            new: true,
        });

        res.json({ code: '1', message: req.t('success'), user });
    } catch (error) {
        next(error);
    }
};

exports.deleteProfile = async (req, res, next) => {
    try {
        await User.findByIdAndDelete(req.user.id);

        res.json({ code: '1', message: req.t('deleted') });
    } catch (error) {
        next(error);
    }
};

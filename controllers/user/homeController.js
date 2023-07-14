const createError = require('http-errors');
const multilingualUser = require('../../utils/multilingualUser');
const formatTimestamp = require('../../utils/formatTimestamp');

const Country = require('../../models/countryModel');
const City = require('../../models/cityModel');
const Banner = require('../../models/bannerModel');
const Notification = require('../../models/notificationModel');

exports.getSelectCountryCity = async (req, res, next) => {
    try {
        await req.user.populate('city country address');
        const user = multilingualUser(req.user, req);

        res.json({
            code: '1',
            message: req.t('success'),
            data: { city: user.city, country: user.country },
        });
    } catch (error) {
        next(error);
    }
};

exports.postSelectCountryCity = async (req, res, next) => {
    try {
        // get city and country by id
        const { city_id, country_id } = req.body;
        const [city, country] = await Promise.all([
            City.findOne({ city_id }),
            Country.findOne({ country_id }),
        ]);
        if (!city) return next(createError.BadRequest('Invalid city_id'));
        if (!country) return next(createError.BadRequest('Invalid country_id'));

        // update user
        let user = req.user;
        user.city = city.id;
        user.country = country.id;
        await user.save();
        await user.populate('city country');
        user = multilingualUser(user, req);

        res.json({
            code: '1',
            message: req.t('success'),
            data: { city: user.city, country: user.country },
        });
    } catch (error) {
        next(error);
    }
};

exports.getBanners = async (req, res, next) => {
    try {
        let banners = await Banner.find().sort('-_id');
        banners = banners.map(el => el.image);

        res.json({ code: '1', message: req.t('success'), data: { banners } });
    } catch (error) {
        next(error);
    }
};

exports.getNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({
            user: req.user.id,
        })
            .select('-__v -user')
            .sort('-_id')
            .populate({
                path: 'bookingId',
                populate: {
                    path: 'car',
                    select: 'pics',
                },
                select: '-user -__v',
            })
            .lean();

        // Format timestamps
        notifications.forEach(notification => {
            notification.image = notification.bookingId?.car?.pics[0];
            notification.bookingId.car = undefined;

            notification.createdAt = formatTimestamp(
                notification.createdAt,
                req
            );
        });

        res.json({ code: '1', message: req.t('success'), notifications });
    } catch (error) {
        next(error);
    }
};

const createError = require('http-errors');
const multilingualUser = require('../../utils/multilingualUser');

const Country = require('../../models/countryModel');
const City = require('../../models/cityModel');

exports.getSelectCountryCity = async (req, res, next) => {
    try {
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

const createError = require('http-errors');
const multilingual = require('../../utils/multilingual');

const Country = require('../../models/countryModel');
const City = require('../../models/cityModel');

exports.getCountries = async (req, res, next) => {
    try {
        let countries = await Country.find().sort('en.name').select('-__v');

        countries = countries.map(el => multilingual(el, req));

        res.json({ code: '1', message: req.t('success'), data: { countries } });
    } catch (error) {
        next(error);
    }
};

exports.getCities = async (req, res, next) => {
    try {
        const { country_id } = req.body;
        const country = await Country.findOne({ country_id });
        if (!country) return next(createError.BadRequest('Invalid country_id'));

        let cities = await City.find({ country: country.id })
            .sort('en.name')
            .select('-__v');

        cities = cities.map(el => multilingual(el, req));

        res.json({ code: '1', message: req.t('success'), data: { cities } });
    } catch (error) {
        next(error);
    }
};

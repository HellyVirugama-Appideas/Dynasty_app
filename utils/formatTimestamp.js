const moment = require('moment');
const accepted = ['en', 'fr', 'ar'];

module.exports = (timestamp, req) => {
    let language = accepted.includes(req.headers['accept-language'])
        ? req.headers['accept-language']
        : 'en';
    moment.locale(language);

    const createdAt = moment(timestamp);
    const now = moment();
    const diffInDays = now.diff(createdAt, 'days');

    if (diffInDays < 7) return createdAt.fromNow();
    else return createdAt.format('MMMM Do YYYY');
};

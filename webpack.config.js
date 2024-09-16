const path = require('path');

module.exports = {
    entry: './js/app.js', // Entry point of your application
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    devServer: {
        static: ".",
        compress: true, // Enable gzip compression
        port: 9000,
    }
};

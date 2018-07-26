const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = [{
    entry: {
        react: './src/index.tsx',
        menu: './src/contextMenuPopup.tsx'
    },
    output: {
        path: path.resolve(__dirname, '../../build/demo'),
        filename: '[name]-bundle.js'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    devtool:'source-map',
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader
                    },
                    "css-loader"
                ]
            },
            {
                test: /\.(png|jpg|gif|otf|svg)$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 8192
                        }
                    }
                ]
            },
            {
                test: /\.tsx?$/,
                loader: 'ts-loader'
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({ filename: '[name]-bundle.css' }),
        new CopyWebpackPlugin([
            { from: './configs', to: 'configs/' },
            { from: 'app-directory.json' },
            { from: './public' }
        ])
    ]
}];

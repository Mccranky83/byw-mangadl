import fs from "node:fs";
import { resolve } from "node:path";
import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";

const { BannerPlugin, ProvidePlugin } = webpack;
const __dirname = import.meta.dirname;
const banner = fs.readFileSync(
  resolve(__dirname, "byw-mangadl.meta.js"),
  "utf-8",
  { encoding: "utf-8", flag: "r" },
);
const headers = banner
  .split("\n")
  .slice(1, -1)
  .map((cur) => cur.slice(3).split(" ")[0].trim());

export default function (_, argv) {
  return {
    entry: "./src/index.js",
    mode: argv.mode || "production",
    output: {
      path: resolve(__dirname),
      filename: "byw-mangadl.user.js",
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /(node_modules)/,
          use: [
            {
              loader: "babel-loader",
              options: {
                presets: ["@babel/preset-env"],
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.html$/,
          use: "html-loader",
        },
      ],
    },
    plugins: [
      new BannerPlugin({
        banner,
        raw: true,
      }),
      new ProvidePlugin({
        $: "jquery",
        jQuery: "jquery",
      }),
    ],
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            format: {
              comments: new RegExp(`==\/?UserScript==|${headers.join("|")}`),
            },
          },
          extractComments: false,
        }),
      ],
    },
  };
}

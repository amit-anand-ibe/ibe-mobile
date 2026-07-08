const { expo } = require("./app.json");

const VALID_ENVIRONMENTS = ["development", "testing", "production"];

const appEnvironment = VALID_ENVIRONMENTS.includes(process.env.APP_ENV)
  ? process.env.APP_ENV
  : "testing";

module.exports = {
  expo: {
    ...expo,
    extra: {
      ...(expo.extra || {}),
      appEnvironment,
    },
  },
};

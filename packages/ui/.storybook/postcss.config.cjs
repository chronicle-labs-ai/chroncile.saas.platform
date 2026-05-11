const path = require("node:path");

module.exports = {
  plugins: {
    tailwindcss: {
      // The root preset doubles as Storybook's Tailwind config.
      // It's self-contained (absolute `content` glob pointing at this
      // package's `src/`) so it works regardless of CWD.
      config: path.resolve(__dirname, "../tailwind.config.ts"),
    },
    autoprefixer: {},
  },
};

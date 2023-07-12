import { defineConfig } from 'dumi';

export default defineConfig({
  themeConfig: {
    nav: {
      mode: 'override',
      value: [],
    },
    logo: false,
    footer: false,
  },
  resolve: {
    docDirs: ['.'],
    codeBlockMode: 'passive',
  },
});

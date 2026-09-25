import { createTheme, MantineColorsTuple } from '@mantine/core';

const cpsTeal: MantineColorsTuple = [
  '#e6f8f5',
  '#cceee9',
  '#99ddcf',
  '#66cbb6',
  '#33ba9c',
  '#007B6D', // Color institucional CPS
  '#006f62',
  '#005d52',
  '#00473f',
  '#002d28',
];

export const theme = createTheme({
  primaryColor: 'cpsTeal',
  colors: {
    cpsTeal,
  },
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  defaultRadius: 'md',
  cursorType: 'pointer',
});

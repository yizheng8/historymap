import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1565c0' },
    secondary: { main: '#e84830' },
    background: {
      default: '#f0f4f8',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a2a3a',
      secondary: '#546e7a',
    },
  },
  typography: {
    fontFamily:
      '"STZhongsong","STSong","Noto Serif SC","SimSun",serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          overflow: 'hidden',
          background: '#c8dce8',
        },
      },
    },
  },
});

export default theme;

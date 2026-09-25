import { render } from 'preact';
// Fonts are bundled so the popup works offline and never loads remote files.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '../styles/tokens.css';
import './popup.css';
import { App } from './app';

render(<App />, document.getElementById('app')!);

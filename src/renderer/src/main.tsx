import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/base.css';

const container = document.getElementById('root');
if (!container) throw new Error('Не найден корневой элемент приложения');

createRoot(container).render(<App />);

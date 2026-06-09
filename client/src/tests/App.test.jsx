import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/auth_context';

describe('App Component', () => {
  it('renders without crashing', () => {
    // Basic test to ensure the app wrapper renders correctly
    const { container } = render(
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    );
    expect(container).toBeDefined();
  });
});

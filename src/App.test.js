import { render, screen } from '@testing-library/react';
import App from './App';

/** Minimal fetch stub so tests never touch the network. */
const mockEmptyDrive = () =>
  jest.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ files: [] }),
      text: () => Promise.resolve(''),
    })
  );

beforeEach(() => {
  window.localStorage.clear();
  mockEmptyDrive();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders the heading and the sign-in prompt when signed out', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /drive view/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
});

test('restores a stored, unexpired session and shows the logout button', () => {
  window.localStorage.setItem(
    'driveview.auth',
    JSON.stringify({ accessToken: 'test-token', expiresAt: Date.now() + 60000 })
  );

  render(<App />);

  expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
});

test('ignores an expired stored session', () => {
  window.localStorage.setItem(
    'driveview.auth',
    JSON.stringify({ accessToken: 'stale-token', expiresAt: Date.now() - 1000 })
  );

  render(<App />);

  expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
});

test('sends the user back to sign-in when Drive answers 401', async () => {
  jest.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
  );
  window.localStorage.setItem(
    'driveview.auth',
    JSON.stringify({ accessToken: 'expired-token', expiresAt: Date.now() + 60000 })
  );

  render(<App />);

  expect(await screen.findByRole('alert')).toHaveTextContent(/session expired/i);
  expect(window.localStorage.getItem('driveview.auth')).toBeNull();
});

import { render, screen, waitFor } from '@testing-library/react';
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

test('restores stored accounts and shows account selector', () => {
  const accounts = [
    { id: 'acc_1', accessToken: 'test-token', expiresAt: Date.now() + 60000, email: 'test@example.com', name: 'Test User', picture: '' },
  ];
  window.localStorage.setItem('driveview.accounts', JSON.stringify(accounts));
  window.localStorage.setItem('driveview.activeAccountId', 'acc_1');

  render(<App />);

  expect(screen.getByRole('heading', { name: /drive view/i })).toBeInTheDocument();
});

test('ignores expired stored accounts', () => {
  const accounts = [
    { id: 'acc_1', accessToken: 'stale-token', expiresAt: Date.now() - 1000, email: 'test@example.com', name: 'Test User', picture: '' },
  ];
  window.localStorage.setItem('driveview.accounts', JSON.stringify(accounts));
  window.localStorage.setItem('driveview.activeAccountId', 'acc_1');

  render(<App />);

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
  const accounts = [
    { id: 'acc_1', accessToken: 'expired-token', expiresAt: Date.now() + 60000, email: 'test@example.com', name: 'Test User', picture: '' },
  ];
  window.localStorage.setItem('driveview.accounts', JSON.stringify(accounts));
  window.localStorage.setItem('driveview.activeAccountId', 'acc_1');

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i);
  });
  // After 401, the expired account is removed, leaving empty array
  expect(window.localStorage.getItem('driveview.accounts')).toBe('[]');
});